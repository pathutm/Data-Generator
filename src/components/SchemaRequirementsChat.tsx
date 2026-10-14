import { useState, useRef, useEffect, useCallback } from 'react';
import type { UserRequirements, UserRequirementMessage } from '../types';
import {
  IconMessageSquare,
  IconSend,
  IconSparkles,
  IconEdit,
  IconTrash,
  IconCheck,
  IconInfo,
  IconX,
} from './Icons';

interface SchemaRequirementsChatProps {
  userRequirements: UserRequirements;
  onRequirementsChange: (req: UserRequirements) => void;
  isSubmitting?: boolean;
}

const EXAMPLE_PROMPTS = [
  'I want a schema for CFO financial analysis, including expenses, revenue, suppliers, invoices, and payments.',
  'I want to analyze cash flow, outstanding invoices, payment delays, and supplier spending.',
  'I want to combine related entities across datasets while preserving the original source lineage.',
  'I want a schema optimized for business intelligence and natural-language questions about financial performance.',
  'I want to identify relationships between customers, orders, products, and payments for sales analysis.',
];

export function SchemaRequirementsChat({
  userRequirements,
  onRequirementsChange,
  isSubmitting = false,
}: SchemaRequirementsChatProps) {
  const [inputText, setInputText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll conversation when new message added
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [userRequirements.messages.length]);

  const handleSelectExample = useCallback((prompt: string) => {
    setInputText(prompt);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  const handleSendMessage = useCallback(() => {
    const trimmed = inputText.trim();
    if (!trimmed || isSubmitting) return;

    if (editingId) {
      // Editing existing message
      const updatedMessages = userRequirements.messages.map((m) =>
        m.id === editingId ? { ...m, content: trimmed } : m
      );

      // If the edited message was the active requirement, update active_requirement as well
      const wasActive = userRequirements.active_requirement ===
        userRequirements.messages.find((m) => m.id === editingId)?.content;

      const newActive = wasActive ? trimmed : userRequirements.active_requirement;

      onRequirementsChange({
        messages: updatedMessages,
        active_requirement: newActive,
      });
      setEditingId(null);
    } else {
      // Adding new message
      const newMessage: UserRequirementMessage = {
        id: `req-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        role: 'user',
        content: trimmed,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      const newMessages = [...userRequirements.messages, newMessage];

      // Most recent message becomes the active schema requirement
      onRequirementsChange({
        messages: newMessages,
        active_requirement: trimmed,
      });
    }

    setInputText('');
  }, [inputText, editingId, isSubmitting, userRequirements, onRequirementsChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    },
    [handleSendMessage]
  );

  const handleStartEdit = useCallback((msg: UserRequirementMessage) => {
    setEditingId(msg.id);
    setInputText(msg.content);
    textareaRef.current?.focus();
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
    setInputText('');
  }, []);

  const handleDeleteMessage = useCallback(
    (id: string) => {
      const remaining = userRequirements.messages.filter((m) => m.id !== id);
      let newActive = userRequirements.active_requirement;

      // If deleted message was active, pick the newest remaining message or empty
      const target = userRequirements.messages.find((m) => m.id === id);
      if (target && target.content === userRequirements.active_requirement) {
        newActive = remaining.length > 0 ? remaining[remaining.length - 1].content : '';
      }

      onRequirementsChange({
        messages: remaining,
        active_requirement: newActive,
      });

      if (editingId === id) {
        setEditingId(null);
        setInputText('');
      }
    },
    [userRequirements, editingId, onRequirementsChange]
  );

  const handleSetActive = useCallback(
    (content: string) => {
      onRequirementsChange({
        ...userRequirements,
        active_requirement: content,
      });
    },
    [userRequirements, onRequirementsChange]
  );

  const handleClearActiveRequirement = useCallback(() => {
    onRequirementsChange({
      ...userRequirements,
      active_requirement: '',
    });
  }, [userRequirements, onRequirementsChange]);

  const handleCombineAllAsActive = useCallback(() => {
    if (userRequirements.messages.length === 0) return;
    const combined = userRequirements.messages.map((m) => m.content.trim()).join('; ');
    onRequirementsChange({
      ...userRequirements,
      active_requirement: combined,
    });
  }, [userRequirements, onRequirementsChange]);

  const handleClearConversation = useCallback(() => {
    onRequirementsChange({
      messages: [],
      active_requirement: '',
    });
    setEditingId(null);
    setInputText('');
  }, [onRequirementsChange]);

  const hasMessages = userRequirements.messages.length > 0;
  const hasActiveReq = Boolean(userRequirements.active_requirement.trim());

  return (
    <section className="section" id="schema-requirements-chat-section">
      {/* Header */}
      <div className="section__header" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 className="section__title">
            <IconMessageSquare className="section__title-icon" size={20} />
            Schema Requirements Chat
          </h2>
          <p className="section__description" style={{ marginBottom: 0 }}>
            Describe what you want this schema to represent and how you plan to use it. Your requirements will guide the schema-generation workflow.
          </p>
        </div>

        {/* Status Pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {hasActiveReq ? (
            <span className="dataset-card__badge badge--success" style={{ fontSize: 12, padding: '4px 12px' }}>
              <IconCheck size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: '-1px' }} />
              Active Requirement Attached
            </span>
          ) : (
            <span className="dataset-card__badge badge--neutral" style={{ fontSize: 12, padding: '4px 12px' }}>
              No Requirement Set (Default)
            </span>
          )}
        </div>
      </div>

      {/* Suggested Example Prompts */}
      <div className="chat-examples-container" style={{ marginTop: 16 }}>
        <div className="chat-examples-label">
          <IconSparkles size={14} style={{ color: 'var(--color-primary)' }} />
          <span>Quick Suggestions (click to populate input):</span>
        </div>
        <div className="chat-example-chips">
          {EXAMPLE_PROMPTS.map((prompt, idx) => (
            <button
              key={idx}
              type="button"
              className="chat-chip-btn"
              onClick={() => handleSelectExample(prompt)}
              disabled={isSubmitting}
              title="Click to populate input with this requirement"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Active Requirement Card */}
      {hasActiveReq && (
        <div className="active-requirement-card" style={{ marginTop: 16 }}>
          <div className="active-requirement-card__header">
            <div className="active-requirement-card__title">
              <span className="active-requirement-indicator" />
              <strong>Active Schema Requirement</strong>
              <span className="active-requirement-tag">Sent to Second LLM Node</span>
            </div>
            <div className="active-requirement-actions">
              <button
                type="button"
                className="btn btn--secondary btn--xs"
                onClick={() => {
                  setInputText(userRequirements.active_requirement);
                  textareaRef.current?.focus();
                }}
                disabled={isSubmitting}
                title="Edit this active requirement"
              >
                <IconEdit size={12} />
                Edit in Input
              </button>
              <button
                type="button"
                className="btn btn--danger btn--xs"
                onClick={handleClearActiveRequirement}
                disabled={isSubmitting}
                title="Remove active requirement"
              >
                <IconX size={12} />
                Clear Active
              </button>
            </div>
          </div>
          <div className="active-requirement-card__content">
            &ldquo;{userRequirements.active_requirement}&rdquo;
          </div>
          <div className="active-requirement-card__footnote">
            <IconInfo size={12} />
            This requirement will be transmitted in <code>user_requirements.active_requirement</code> to guide entity clustering, naming, and relationship formulation.
          </div>
        </div>
      )}

      {/* Conversation Thread */}
      <div className="chat-thread-container" style={{ marginTop: 16 }}>
        <div className="chat-thread-header">
          <span className="chat-thread-title">
            Conversation History ({userRequirements.messages.length} message{userRequirements.messages.length !== 1 ? 's' : ''})
          </span>
          {hasMessages && (
            <div className="chat-thread-controls">
              {userRequirements.messages.length > 1 && (
                <button
                  type="button"
                  className="chat-btn-link"
                  onClick={handleCombineAllAsActive}
                  disabled={isSubmitting}
                  title="Combine all message requirements into one"
                >
                  Combine All as Active
                </button>
              )}
              <button
                type="button"
                className="chat-btn-link chat-btn-link--danger"
                onClick={handleClearConversation}
                disabled={isSubmitting}
                title="Clear all messages in the conversation"
              >
                <IconTrash size={12} />
                Clear Conversation
              </button>
            </div>
          )}
        </div>

        <div className="chat-thread-messages">
          {!hasMessages ? (
            <div className="chat-empty-state">
              <IconMessageSquare size={32} className="chat-empty-icon" />
              <p className="chat-empty-title">No schema requirements added yet</p>
              <p className="chat-empty-subtitle">
                Enter your business goals, target entities, or analysis requirements below, or click any suggestion above.
              </p>
            </div>
          ) : (
            userRequirements.messages.map((msg) => {
              const isActive = msg.content === userRequirements.active_requirement;
              const isBeingEdited = editingId === msg.id;

              return (
                <div
                  key={msg.id}
                  className={`chat-message-row ${isActive ? 'chat-message-row--active' : ''}`}
                >
                  <div className="chat-message-bubble">
                    <div className="chat-message-header">
                      <div className="chat-message-meta">
                        <span className="chat-message-badge">Your Requirement</span>
                        <span className="chat-message-time">{msg.timestamp}</span>
                        {isActive && (
                          <span className="chat-active-badge">
                            <IconCheck size={10} /> Active Target
                          </span>
                        )}
                        {isBeingEdited && (
                          <span className="chat-editing-badge">Editing Now</span>
                        )}
                      </div>

                      <div className="chat-message-actions">
                        {!isActive && (
                          <button
                            type="button"
                            className="chat-action-btn"
                            onClick={() => handleSetActive(msg.content)}
                            disabled={isSubmitting}
                            title="Make this the active requirement for the workflow"
                          >
                            Set Active
                          </button>
                        )}
                        <button
                          type="button"
                          className="chat-action-btn"
                          onClick={() => handleStartEdit(msg)}
                          disabled={isSubmitting}
                          title="Edit this message"
                        >
                          <IconEdit size={12} />
                        </button>
                        <button
                          type="button"
                          className="chat-action-btn chat-action-btn--delete"
                          onClick={() => handleDeleteMessage(msg.id)}
                          disabled={isSubmitting}
                          title="Delete message"
                        >
                          <IconTrash size={12} />
                        </button>
                      </div>
                    </div>

                    <div className="chat-message-body">{msg.content}</div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Chat Input Area */}
      <div className="chat-input-area" style={{ marginTop: 16 }}>
        {editingId && (
          <div className="chat-editing-banner">
            <span>
              <strong>Editing Message:</strong> Changes will update this requirement in the conversation.
            </span>
            <button
              type="button"
              className="chat-btn-link"
              onClick={handleCancelEdit}
            >
              Cancel
            </button>
          </div>
        )}

        <div className="chat-input-container">
          <textarea
            ref={textareaRef}
            className="chat-textarea"
            rows={3}
            placeholder={
              editingId
                ? 'Update your schema requirement...'
                : 'Describe what you want the consolidated schema to represent (e.g. CFO reporting, customer 360, procurement analysis)...'
            }
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isSubmitting}
          />

          <div className="chat-input-footer">
            <span className="chat-input-hint">
              Press <kbd>Enter</kbd> to send · <kbd>Shift + Enter</kbd> for newline
            </span>

            <div className="chat-input-buttons">
              {editingId && (
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  onClick={handleCancelEdit}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
              )}

              <button
                type="button"
                className="btn btn--primary btn--sm"
                onClick={handleSendMessage}
                disabled={!inputText.trim() || isSubmitting}
                id="send-requirement-button"
              >
                {editingId ? (
                  <>
                    <IconCheck size={14} />
                    Update Requirement
                  </>
                ) : (
                  <>
                    <IconSend size={14} />
                    Send Requirement
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
