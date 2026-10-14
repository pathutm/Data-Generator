import { useState, useCallback, useRef, useEffect } from 'react';
import type { UploadedFile, DatasetInfo, SubmissionResult, UserRequirements, CollectionRunContext } from './types';
import { extractZip } from './utils/zipExtractor';
import { parseCsvFile } from './utils/csvParser';
import { Navbar } from './components/Navbar';
import { Sidebar, type ActiveNavPage } from './components/Sidebar';
import { DataGenerationChatPage, deriveTopicFromMessage } from './components/DataGenerationChatPage';
import { CollectedDatasetsPage } from './components/CollectedDatasetsPage';
import { SchemaUploadPage } from './components/SchemaUploadPage';
import { SchemaVisualisationPage } from './components/SchemaVisualisationPage';

let datasetIdCounter = 1;

function App() {
  const [activePage, setActivePage] = useState<ActiveNavPage>('schema_gen_upload');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [topicFilterForDatasets, setTopicFilterForDatasets] = useState<string>('');
  const [activeCollectionRun, setActiveCollectionRun] = useState<CollectionRunContext | null>(null);

  // ─── Manual Dataset Upload State (Preserved across all navigation) ─
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [datasets, setDatasets] = useState<DatasetInfo[]>([]);
  const [userRequirements, setUserRequirements] = useState<UserRequirements>(() => {
    try {
      const saved = localStorage.getItem('dc_agent_user_requirements');
      if (saved) return JSON.parse(saved);
    } catch {
      // Ignored
    }
    return {
      messages: [],
      active_requirement: '',
    };
  });

  // Keep requirements saved across page refreshes and navigation
  useEffect(() => {
    try {
      localStorage.setItem('dc_agent_user_requirements', JSON.stringify(userRequirements));
    } catch {
      // Ignored
    }
  }, [userRequirements]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');
  const [processingProgress, setProcessingProgress] = useState(0);
  const [submissionResult, setSubmissionResult] = useState<SubmissionResult | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // ─── File management ──────────────────────────────────────
  const handleFilesChange = useCallback((files: UploadedFile[]) => {
    setUploadedFiles(files);
  }, []);

  // ─── Processing ───────────────────────────────────────────
  const handleProcess = useCallback(async () => {
    const validFiles = uploadedFiles.filter((f) => f.status === 'valid');
    if (validFiles.length === 0) return;

    const completedZipNames = new Set(
      datasets
        .filter((d) => d.processing_status === 'complete')
        .map((d) => d.original_zip_filename)
    );

    const unprocessedFiles = validFiles.filter(
      (f) => !completedZipNames.has(f.name)
    );

    const filesToProcess =
      unprocessedFiles.length > 0 ? unprocessedFiles : validFiles;

    setIsProcessing(true);
    setProcessingProgress(0);

    const controller = new AbortController();
    abortRef.current = controller;
    const total = filesToProcess.length;

    for (let i = 0; i < filesToProcess.length; i++) {
      if (controller.signal.aborted) break;

      const uploadedFile = filesToProcess[i];
      const datasetName = uploadedFile.name.replace(/\.zip$/i, '');

      setProcessingMessage(
        `Processing ${i + 1} of ${total}: ${uploadedFile.name}…`
      );
      setProcessingProgress((i / total) * 100);

      const datasetInfo: DatasetInfo = {
        id: `ds-${datasetIdCounter++}`,
        dataset_name: datasetName,
        original_zip_filename: uploadedFile.name,
        table_count: 0,
        tables: [],
        skipped_files: [],
        nested_archives: [],
        processing_status: 'extracting',
        excluded: false,
      };

      try {
        const extraction = await extractZip(
          uploadedFile.file,
          (msg) => setProcessingMessage(`[${i + 1}/${total}] ${msg}`),
          controller.signal
        );

        if (controller.signal.aborted) break;

        datasetInfo.skipped_files = extraction.skippedFiles;
        datasetInfo.nested_archives = extraction.nestedArchives;
        datasetInfo.processing_status = 'parsing';

        setProcessingMessage(
          `[${i + 1}/${total}] Parsing ${extraction.csvFiles.length} CSV file${extraction.csvFiles.length !== 1 ? 's' : ''}…`
        );

        for (const csvFile of extraction.csvFiles) {
          if (controller.signal.aborted) break;

          try {
            const tableInfo = parseCsvFile(csvFile);
            datasetInfo.tables.push(tableInfo);
          } catch (err) {
            datasetInfo.tables.push({
              table_name: csvFile.filename.replace(/\.csv$/i, ''),
              original_filename: csvFile.filename,
              relative_path: csvFile.relativePath,
              column_count: 0,
              columns: [],
              header_row: [],
              sample_rows: [],
              total_data_rows: 0,
              parse_status: 'error',
              warnings: [
                `Failed to parse: ${err instanceof Error ? err.message : 'Unknown error'}`,
              ],
              excluded: false,
              detected_delimiter: ',',
              has_duplicate_headers: false,
              duplicate_header_names: [],
            });
          }
        }

        datasetInfo.table_count = datasetInfo.tables.length;
        datasetInfo.processing_status = 'complete';
      } catch (err) {
        if (controller.signal.aborted) {
          datasetInfo.processing_status = 'cancelled';
          datasetInfo.processing_error = 'Processing cancelled by user.';
        } else {
          datasetInfo.processing_status = 'error';
          datasetInfo.processing_error =
            err instanceof Error ? err.message : 'Unknown error during extraction.';
        }
      }

      setDatasets((prev) => {
        const existingIndex = prev.findIndex(
          (d) => d.original_zip_filename === datasetInfo.original_zip_filename
        );
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = datasetInfo;
          return updated;
        }
        return [...prev, datasetInfo];
      });

      setProcessingProgress(((i + 1) / total) * 100);
    }

    setIsProcessing(false);
    setProcessingMessage('');
    abortRef.current = null;
  }, [uploadedFiles, datasets]);

  const handleToggleDatasetSelect = useCallback((id: string) => {
    setDatasets((prev) =>
      prev.map((ds) => (ds.id === id ? { ...ds, excluded: !ds.excluded } : ds))
    );
  }, []);

  const handleSelectAllDatasets = useCallback(() => {
    setDatasets((prev) => prev.map((ds) => ({ ...ds, excluded: false })));
  }, []);

  const handleDeselectAllDatasets = useCallback(() => {
    setDatasets((prev) => prev.map((ds) => ({ ...ds, excluded: true })));
  }, []);

  const handleUpdateDataset = useCallback(
    (id: string, updates: Partial<DatasetInfo>) => {
      setDatasets((prev) =>
        prev.map((ds) => (ds.id === id ? { ...ds, ...updates } : ds))
      );
    },
    []
  );

  const handleToggleTableExclude = useCallback(
    (datasetId: string, relativePath: string) => {
      setDatasets((prev) =>
        prev.map((ds) => {
          if (ds.id !== datasetId) return ds;
          return {
            ...ds,
            tables: ds.tables.map((t) =>
              t.relative_path === relativePath
                ? { ...t, excluded: !t.excluded }
                : t
            ),
          };
        })
      );
    },
    []
  );

  const handleRemoveDataset = useCallback((id: string) => {
    setDatasets((prev) => {
      const dsToRemove = prev.find((d) => d.id === id);
      if (dsToRemove) {
        setUploadedFiles((files) =>
          files.filter((f) => f.name !== dsToRemove.original_zip_filename)
        );
      }
      return prev.filter((ds) => ds.id !== id);
    });
  }, []);

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleSubmissionStart = useCallback(() => { }, []);

  const handleSubmissionComplete = useCallback((result: SubmissionResult) => {
    setSubmissionResult(result);
  }, []);

  const processedZipNames = new Set(
    datasets
      .filter((d) => d.processing_status === 'complete')
      .map((d) => d.original_zip_filename)
  );

  const hasResults = datasets.length > 0;

  // Page title for Navbar
  const getPageTitle = () => {
    switch (activePage) {
      case 'data_gen_chat':
        return 'Data Generation Agent / Chat & History';
      case 'data_gen_datasets':
        return 'Data Generation Agent / Collected Datasets';
      case 'schema_gen_upload':
        return 'Schema Generation Agent / Upload Dataset';
      case 'schema_gen_visualisation':
        return 'Schema Generation Agent / Visualisation';
    }
  };

  return (
    <div className="app-layout">
      {/* ─── Persistent Left Sidebar ─── */}
      <Sidebar
        activePage={activePage}
        onNavigate={setActivePage}
        schemaReady={submissionResult?.status === 'success'}
        uploadedDatasetCount={datasets.filter((d) => !d.excluded).length}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* ─── App Main Content Wrapper ─── */}
      <div className="app-main-wrapper">
        <Navbar
          onToggleMobileSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
          activeTitle={getPageTitle()}
        />

        <main className="main-content">
          {/* Subpage 1: Data Generation Agent → Chat & History */}
          {activePage === 'data_gen_chat' && (
            <DataGenerationChatPage
              onLatestMessageSubmitted={(info) => {
                const dynamicTopic = deriveTopicFromMessage(info.text);
                setActiveCollectionRun({
                  runId: info.runId,
                  topic: dynamicTopic,
                  requestText: info.text,
                  timestamp: info.timestamp,
                });
                setTopicFilterForDatasets(dynamicTopic);
              }}
              onSelectRequirementForSchema={(reqText) => {
                setUserRequirements({
                  messages: [
                    ...userRequirements.messages,
                    {
                      id: `req-chat-${Date.now()}`,
                      role: 'user',
                      content: reqText,
                      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    },
                  ],
                  active_requirement: reqText,
                });
                setActivePage('schema_gen_upload');
              }}
              onNavigateToDatasets={(ctx) => {
                if (typeof ctx === 'string') {
                  setTopicFilterForDatasets(ctx);
                  setActiveCollectionRun(null);
                } else if (ctx) {
                  setActiveCollectionRun(ctx);
                  setTopicFilterForDatasets(ctx.topic || '');
                }
                setActivePage('data_gen_datasets');
              }}
              onNavigateToSchemaUpload={() => setActivePage('schema_gen_upload')}
            />
          )}

          {/* Subpage 2: Data Generation Agent → Collected Datasets */}
          {activePage === 'data_gen_datasets' && (
            <CollectedDatasetsPage
              initialTopicFilter={topicFilterForDatasets}
              onClearTopicFilter={() => setTopicFilterForDatasets('')}
              activeRunContext={activeCollectionRun}
              onClearRunContext={() => setActiveCollectionRun(null)}
            />
          )}

          {/* Subpage 3: Schema Generation Agent → Upload Dataset */}
          {activePage === 'schema_gen_upload' && (
            <SchemaUploadPage
              uploadedFiles={uploadedFiles}
              onFilesChange={handleFilesChange}
              onProcess={handleProcess}
              isProcessing={isProcessing}
              processingMessage={processingMessage}
              processingProgress={processingProgress}
              onCancel={handleCancel}
              hasResults={hasResults}
              processedZipNames={processedZipNames}
              datasets={datasets}
              onToggleDatasetSelect={handleToggleDatasetSelect}
              onSelectAllDatasets={handleSelectAllDatasets}
              onDeselectAllDatasets={handleDeselectAllDatasets}
              onUpdateDataset={handleUpdateDataset}
              onToggleTableExclude={handleToggleTableExclude}
              onRemoveDataset={handleRemoveDataset}
              userRequirements={userRequirements}
              onRequirementsChange={setUserRequirements}
              onSubmissionStart={handleSubmissionStart}
              onSubmissionComplete={handleSubmissionComplete}
              submissionResult={submissionResult}
              onNavigateToVisualisation={() => setActivePage('schema_gen_visualisation')}
            />
          )}

          {/* Subpage 4: Schema Generation Agent → Visualisation */}
          {activePage === 'schema_gen_visualisation' && (
            <SchemaVisualisationPage
              currentResult={submissionResult}
              activeRequirement={userRequirements.active_requirement}
              sourceDatasetNames={datasets.map((d) => d.dataset_name)}
              onNavigateToUpload={() => setActivePage('schema_gen_upload')}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
