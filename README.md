# DATASET DISCOVERY & SCHEMA GENERATION PLATFORM
## Project Technical Documentation

**Project:** Agent Workbench – Dataset Schema Inspector  
**Document Date:** 13 October 2026  
**Modules:** Data Generation Agent and Schema Generation Agent  

---

## 1. Project Overview

### 1.1 Objective
The Dataset Discovery and Schema Generation Platform is designed to help users discover publicly accessible datasets, collect relevant source information, inspect uploaded datasets, and generate a consolidated schema representation for understanding data structures and relationships.

The platform consists of two connected functional modules:
- **Data Generation Agent:** Discovers datasets based on a user’s natural-language requirements, searches supported public data platforms, processes source information, and records collection results.
- **Schema Generation Agent:** Accepts uploaded datasets, cleans and extracts their structural information, consolidates schema details, and presents entities, columns, relationships, and uncertainties through an interactive visualization interface.

The overall objective is to reduce manual effort in dataset discovery and schema analysis while making source information and potential relationships easier to inspect.

### 1.2 Technology and Integrations
The exported workflows and current UI indicate the use of the following components:
- **AI/LLM services:** Groq-hosted language model for requirement analysis and Gemini for schema consolidation.
- **Dataset search:** Tavily web search.
- **Source processing:** JavaScript code nodes and HTTP requests.
- **Data storage:** Supabase, with a PostgreSQL insert operation in the dataset collection workflow.
- **User interface:** Agent Workbench / Dataset Schema Inspector, running locally at the time of the screenshots.
- **Supported discovery platforms:** Kaggle, Hugging Face, GitHub, and Zenodo.

> **Note:** These are the integrations visible in the exported workflows. Production deployment details and additional infrastructure are not established by the available screenshots and workflow exports.

---

## 2. Agent 1 – Data Generation Agent

### 2.1 Purpose
The Data Generation Agent discovers potentially relevant public datasets using the user’s natural-language request. It searches multiple platforms, processes the returned results, resolves platform-specific source URLs where possible, extracts available file information, and prepares records for storage and display.

The workflow is designed to retain the original request topic so that results can be associated with the correct collection request.

### 2.2 Workflow and Processing Steps

#### Step 1 – User request
The user submits a requirement through the Chat & History interface. For example, the request may ask for insurance datasets containing customers, policies, premiums, claims, settlements, and risk information.

#### Step 2 – Requirement analysis
A language-model node analyzes the current message and extracts information such as the request topic, domain, and relevant entities. A JavaScript processing node parses and normalizes the model output into structured fields.

#### Step 3 – Multi-platform discovery
Tavily search nodes independently search the following platforms:
- **Kaggle:** Dataset discovery through search results.
- **Hugging Face:** Search for dataset-related sources.
- **GitHub:** Search for repositories or files that may contain datasets.
- **Zenodo:** Search for research datasets and related records.

The search nodes are configured with result limits. Therefore, the number of results returned depends on the search response, relevance, filtering, and configured limits; the limit is not a guarantee that every platform will return the same number of datasets.

#### Step 4 – Source validation and deduplication
The workflow processes search results, checks source URLs, categorizes results by platform, filters unsuitable sources, and removes duplicate source entries. The intent is to retain useful dataset-related results rather than treating every search result as a valid downloadable dataset.

#### Step 5 – Platform-specific URL resolution and file extraction
The workflow separates results by platform and uses HTTP requests and code nodes to retrieve or process available source metadata and file listings.

Platform-specific processing nodes handle Kaggle, Hugging Face, GitHub, and Zenodo. The extracted information depends on what the source makes accessible and on whether the URL and response format are supported by the relevant processing logic.

#### Step 6 – Record preparation and storage
The workflow prepares records containing request and source information, including the request topic and available source metadata. PostgreSQL insert nodes are used to save collection records, and the workflow builds a summary of the collection results.

### 2.3 Output
The Data Generation Agent is intended to provide:
- Dataset discovery results grouped by source platform.
- Source titles and URLs where available.
- Request-topic association for collected records.
- Available file or download information, subject to source accessibility.
- Platform-level result counts and a total collection count.
- Stored collection records for subsequent access through the application.

A result discovered through web search is not automatically proof that a dataset file was downloaded successfully. Discovery, source resolution, file extraction, and storage are distinct stages.

---

## 3. Agent 1 – User Interface

### 3.1 Chat & History
The Chat & History page provides the main interface for submitting dataset requirements and reviewing earlier requests.

The visible UI includes:
- A Chat History panel listing previous requests.
- A New Chat control to begin another request.
- A request area displaying the submitted user message.
- A Data Collector Agent response summarizing the collection results.
- A View Datasets for this Run action.
- A Use as Schema Requirement action.
- A Run Collector button and message input area.
- A Supabase connection status indicator.

### 3.2 Collection Summary
The collection summary presents the number of records reported for each platform and the overall total.

**Example:**

| Platform | Records reported |
| :--- | :--- |
| Kaggle | 3 |
| Hugging Face | 0 |
| GitHub | 1 |
| Zenodo | 1 |
| **Total** | **5** |

These figures represent the specific collection run visible in the screenshot; they are not fixed system-wide totals.

### 3.3 Dataset Access and Navigation
The left navigation provides access to:
- **Chat & History:** Submit requirements and review request history.
- **Collected Datasets:** Access the dataset repository area.
- **Upload Dataset:** Submit datasets for schema inspection.
- **Visualisation:** View consolidated schema information and relationships.

The UI also provides an action to use a dataset-discovery request as a schema requirement. This creates a path from the discovery workflow to the schema-analysis workflow.

---

## 4. Agent 2 – Schema Generation Agent

### 4.1 Purpose
The Schema Generation Agent processes uploaded datasets and produces a consolidated representation of their structure. It identifies datasets, tables, columns, possible semantic mappings, relationships, and unresolved uncertainties.

Its primary objective is to make the structure of multiple datasets easier to understand without losing the original source-column references or assuming that similarly named fields necessarily represent the same business concept.

### 4.2 Workflow and Processing Steps

#### Step 1 – Dataset upload input
The workflow receives a dataset payload through a webhook. The input-processing code expects a datasets array containing dataset names and table information, including column information or header rows.

The UI provides an Upload Dataset area for inspecting and submitting ZIP files. The exact file-extraction implementation is not fully established by the exported schema-processing workflow alone.

#### Step 2 – Cleaning and normalization
The Prepare & Clean Schema code node:
- Reads the submitted dataset information.
- Removes macOS metadata entries such as `.DS_Store`, `__MACOSX`, and `._` files.
- Normalizes table and column names by trimming whitespace.
- Accepts columns represented as strings or supported column objects.
- Removes duplicate column names within a table.
- Excludes tables without valid columns and datasets without remaining valid tables.

#### Step 3 – Schema preparation
The cleaned input is organized into a structured schema containing dataset names, table names, and columns. The workflow calculates the number of datasets, tables, and columns and passes the prepared schema to the language-model node.

#### Step 4 – Schema consolidation
A Gemini language-model node analyzes the input to identify semantically equivalent fields, standardized entities, source mappings, and potential relationships. The instructions require original dataset, table, and column references to be preserved and unrelated business domains to remain separate unless evidence supports a connection.

#### Step 5 – Validation and completeness checking
The workflow validates the structure of the model response and checks for required sections, including entities, source mappings, relationships, and uncertainties. Additional code nodes extract source-column information and perform completeness-related processing.

The workflow is designed to distinguish supported relationships from inferred or uncertain ones rather than treating every possible mapping as confirmed.

#### Step 6 – Output preparation
The processed schema information is formatted for the response and visualization interface. The output includes consolidated schema data and source-schema information, along with available dataset, table, and column counts.

### 4.3 Key Schema Concepts
- **Entities:** Logical representations of tables or business concepts.
- **Columns:** Attributes belonging to an entity, with standardized names where appropriate.
- **Source mappings:** Links between semantically equivalent source fields.
- **Relationships:** Connections between source fields, including supported key-based relationships and other supported semantic relationships.
- **Uncertainties:** Potential mappings or relationships that require further evidence or human review.
- **Source references:** Original dataset, table, and column identifiers retained to support traceability.

A relationship inferred from schema information should not automatically be treated as a verified database foreign key. Its status and supporting evidence should remain visible.

---

## 5. Agent 2 – Visualization UI

### 5.1 Consolidated Schema Overview
The Visualisation page presents a consolidated schema summary, including the request used to generate the schema and the run information.

| Metric | Displayed value |
| :--- | :--- |
| Consolidated entities | 16 |
| Total columns | 123 |
| Total relationships | 5 |
| Confirmed relationships | 5 |
| Uncertain mappings | 1 |

These are the values displayed for the example run, not permanent platform totals.

### 5.2 Interactive ER Diagram
The central panel presents an interactive Entity–Relationship (ER) diagram. The visible interface supports:
- Viewing entity/table cards and their columns.
- Inspecting relationship connectors and their associated field references.
- Distinguishing confirmed and uncertain links through the legend.
- Highlighting tables or columns using the search control.
- Zooming, resetting the view, and expanding the diagram.
- Rearranging nodes within the diagram.

The diagram is intended to help users understand how tables are organized and how relationships connect source fields.

### 5.3 Tables & Columns Explorer
The page also includes a Tables & Columns Explorer with Expand All and Collapse All controls. This section provides a more detailed view of schema information alongside the graphical ER diagram.

### 5.4 Run History and Raw Output
The interface displays controls for viewing raw JSON and run history. These allow users to inspect the structured output and review previous schema-generation runs.

Together, the summary metrics, ER diagram, source-column explorer, and raw output provide both a high-level overview and a detailed inspection path.

---

## 6. Integration, Validation and Current Scope

### 6.1 Relationship Between the Agents
The two agents support different stages of the data workflow:
```
Dataset Discovery → Collection Results → Dataset Selection or Schema Requirement → Dataset Upload/Processing → Schema Consolidation → ER Visualization
```

The Data Generation Agent focuses on finding and recording relevant sources. The Schema Generation Agent focuses on analyzing dataset structures and representing their entities and relationships. The UI provides navigation and actions that support movement between these stages.

### 6.2 Important Validation Considerations
The following checks are important when testing the platform:
- **Relevance:** Results should match the latest user request rather than a previous topic.
- **Platform coverage:** Each platform should be checked independently for valid results.
- **Source validity:** Search results should be distinguished from confirmed dataset files and successful downloads.
- **Deduplication:** Duplicate URLs or duplicate records should not inflate the reported total.
- **Schema completeness:** Original source columns should be retained and accounted for.
- **Relationship correctness:** Shared column names alone should not be treated as proof of a relationship.
- **Uncertainty handling:** Inferred relationships should be distinguishable from confirmed relationships.
- **UI consistency:** Displayed counts and schema metrics should correspond to the correct run and its underlying output.
- **Error handling:** Empty search results, unsupported URLs, inaccessible files, invalid uploads, and malformed model output should be handled clearly.

### 6.3 Current Scope and Limitations
The screenshots and workflow exports establish the current workflow configuration and the UI shown for the example runs. They do not, by themselves, verify every possible search result, successful download, production deployment, or end-to-end behavior for all file formats.

Dataset discovery is dependent on search relevance, platform accessibility, source URL formats, and extraction logic. Likewise, schema consolidation depends on the quality and completeness of uploaded metadata and model output. These aspects should be validated through representative end-to-end tests before the system is considered production-ready.

---

## 7. Conclusion
The project combines dataset discovery with schema analysis in a single interface. The Data Generation Agent supports natural-language dataset discovery across Kaggle, Hugging Face, GitHub, and Zenodo, while the Schema Generation Agent cleans dataset metadata, consolidates schema information, and presents entities, columns, mappings, and relationships visually.

The Agent Workbench UI brings these capabilities together through chat history, collection summaries, dataset access, upload options, schema metrics, an interactive ER diagram, a table-and-column explorer, and run-inspection controls.

The current implementation provides a foundation for reducing manual dataset discovery and schema inspection effort. Further validation of source accessibility, result relevance, schema completeness, and relationship accuracy will help establish reliability across a wider range of real-world datasets.
