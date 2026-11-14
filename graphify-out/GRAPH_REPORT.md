# Graph Report - proxipilot  (2026-11-09)

## Corpus Check
- Large corpus: 643 files · ~414,744 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder.

## Summary
- 5616 nodes · 14390 edges · 233 communities (194 shown, 39 thin omitted)
- Extraction: 88% EXTRACTED · 12% INFERRED · 0% AMBIGUOUS · INFERRED: 1744 edges (avg confidence: 0.93)
- Token cost: 1,068,712 input · 0 output

## Community Hubs (Navigation)
- Reply Planner & Drafts
- Evidence Fusion & Verification
- Requirement Intent Planner
- Integration Account Core
- Organizations & Onboarding Models
- Gmail Sync & Inbox Models
- Auth Service & Sessions
- Row Quality & Data Pipeline
- Dataset Profiling & Column Mapping
- Frontend Knowledge Module
- Gmail Ingestion & Outbox Relay
- ORM Base & Tenant Mixin
- Flexible Schema API
- Knowledge Persistence Service
- Landing Page Layout
- Knowledge Import Worker & Parser
- Flexible Schema Engine
- Embedding Providers
- Knowledge Sources
- File Storage Providers
- Knowledge Import Jobs
- Integrations UI
- Knowledge CRUD Service
- Inbox API Routes
- Dashboard Overview UI
- Onboarding API
- Hybrid Retrieval Service
- App Configuration Settings
- Alembic Migrations
- Embedding Pipeline & Reconciliation
- Knowledge Projection & Embedding Worker
- Retrieval Router Benchmarks
- Evidence Package Selector
- Retrieval Router Tests
- Registration Auth Forms
- Frontend Providers & Stores
- Onboarding Step Forms & Hooks
- Knowledge Service & Attributes
- Knowledge API Routes
- Landing Problem Section
- Frontend API Client & Errors
- Multi-Intent Decomposer
- Knowledge Category Projectors
- Email Parser
- Integrations API Routes
- Embedding Profiles & Crypto
- Knowledge Category Registry
- Structured Retriever & Read Contract
- App Shell Navigation
- Scroll Animation Primitives
- Range & Price Extraction
- Client Dependencies
- App Entrypoint & CLI
- Pub/Sub Auth Verification
- AI Contracts & Enums
- Version Diff Engine
- Tenant, Membership & Onboarding Docs
- Gmail API Client
- Frontend Inbox Service
- Hero Pipeline Visual
- Frontend Architecture Docs
- Audit Events & Retention
- Bento Grid UI & Utils
- Semantic Chunker
- Qdrant Client Manager
- Tenant Scoping Utilities
- Conversation Context Resolver
- Registration Shell UI
- Schema Detection & Mapping Docs
- Email Filter Classification
- Engineering Audit Baseline
- Authorization Service (RBAC)
- Frontend Logging & Analytics
- Phase 10.1 Context Resolver Docs
- Qdrant Knowledge Indexer
- Setup & Scaling Docs
- Dashboard & App Shell Docs
- Knowledge Data Contract Docs
- Client Frontend & Security Docs
- Client TS Config
- Canonical Data Contract Docs
- Retrieval Router Phase 4 Docs
- Multi-Category Ingestion Benchmark
- Tenant Scoping & Envelope Docs
- Tenant Isolation Rules Docs
- Redis Manager & Locks
- Worker Base Classes
- Server ADRs (DB, Vector, Tenancy)
- Qdrant Schema & RAG Docs
- Server Frontend & Security Docs
- Package
- Knowledge Schemas
- Index
- Knowledge Taxonomy
- Phase 7 Reply Planning Validation Implem
- Verifier
- Gmail Renewal Scheduler
- Email Pipeline Latency Root Cause And Re
- Performance
- Ai Architecture
- Producttabswitcher
- Security
- Phase 5 Candidate Fusion Evidence Verifi
- File Validation
- Messaging
- Database
- Ai Development Rules
- Tenant Resolution
- Adr 013 Role Permission Model
- Backend Implementation Plan
- Base
- Event Architecture
- Knowledge Storage Audit
- Architecture
- Page
- Conversationlistitem
- Testimonialcarousel
- Rbac
- Rag Contracts
- Architecture 2
- Knowledge Column Mapping
- Phase 3 Requirement Intent Planner Imple
- Messaging 2
- Useinbox
- Conversation Aware Novelty Retrieval Imp
- Email Pipeline Latency Root Cause And Re 2
- Gmail Sync Architecture
- Phase 1 Infrastructure Audit
- Rbac Architecture
- Messaging 3
- Docker Compose
- Event Architecture 2
- Adr 004 Worker Architecture
- Adr 019 Audit Event Model
- Event Architecture 3
- Gmail Oauth Architecture
- Knowledge Deduplication
- Phase 10 0 Event Contract
- Phase 10 0 Ingestion Audit
- Lru Ttl Cache
- Bloom Filter
- Priority Queue
- Presentation Tracker
- Emailingeststack
- Adr 021 Frontend Auth Backend Contract
- Ai Contracts
- Ai Development Rules 2
- Integrations Ui
- Knowledge Crud Api
- Knowledge File Storage
- Knowledge Import Architecture
- Http Client
- Knowledge Retention
- Embedding Architecture
- Enterprise Multi Category Knowledge Inge
- Knowledge Temporal Lifecycle
- Client Tenant Architecture
- Backend Setup
- Animation System
- Mapping Compatibility
- Ai Architecture 2
- Gmail Integration
- Knowledge Category Schemas
- Performance 2
- Similarity
- Architecture 3
- Ai Architecture 3
- Knowledge Dataset Profiling
- Knowledge Retrieval Contract
- Knowledge Qdrant Reconciliation
- Phase 10 0 Load Test Report
- Health
- Pagination
- Embedding Service
- Docker Compose 2
- Enterprise Knowledge Ingestion Api Cost 
- Readme
- Package 2
- Conversationdetailpane
- Orgpillarsbar
- Animation System 2
- Gmail Operations
- Knowledge Architecture
- Knowledge Parser Architecture
- Knowledge Sources Lineage
- Phase 3 Gmail Integration
- Token Bucket
- Docker Compose 3
- Performance 3
- Knowledge Semantic Projection
- Database Architecture
- Controlvisualstage
- Pricingplancards
- Dsa Algorithms
- Findings
- Knowledge Multi Tenant Schema
- Landing Page
- Security Testing
- Docker Compose 4
- Section
- Metadata
- Auth Security Tests
- Knowledge Flexible Attributes
- Observability
- Docker Compose 5
- Docker Compose 6
- Docker Compose 7
- Docker Compose 8
- Docker Compose 9
- Analyticscockpitframe
- Faqvisualstage
- Proxy
- Adr 002 Database
- Client Auth Architecture
- Database Architecture 2
- Deduplication Engine
- Docker Compose 10
- Spacing
- Context
- Test Evidence Package Benchmark
- Next
- Adr 010 Multi Gmail Account Model
- File
- Globe
- Window
- Pyproject

## God Nodes (most connected - your core abstractions)
1. `react` - 154 edges
2. `@mui/material` - 114 edges
3. `KnowledgeItem` - 95 edges
4. `KnowledgeVersion` - 95 edges
5. `RequirementPlan` - 84 edges
6. `ContextEnvelope` - 81 edges
7. `get_settings()` - 78 edges
8. `DomainEvent` - 66 edges
9. `IntentType` - 64 edges
10. `next` - 59 edges

## Surprising Connections (you probably didn't know these)
- `Multi-Tenant Scoping Utilities` --semantically_similar_to--> `Tenant Data Isolation`  [INFERRED] [semantically similar]
  walkthrough.md → client/docs/SECURITY.md
- `build_tenant_cache_key` --semantically_similar_to--> `RedisManager.build_tenant_key`  [INFERRED] [semantically similar]
  walkthrough.md → client/docs/AI-DEVELOPMENT-RULES.md
- `build_qdrant_tenant_filter` --semantically_similar_to--> `QdrantManager.build_tenant_filter`  [INFERRED] [semantically similar]
  walkthrough.md → client/docs/AI-DEVELOPMENT-RULES.md
- `Modular Monolith First` --semantically_similar_to--> `Modular Monolith with Independently Scalable Workers`  [INFERRED] [semantically similar]
  docs/ARCHITECTURE.md → client/docs/adr/ADR-004-worker-architecture.md
- `get_current_tenant_id` --semantically_similar_to--> `get_tenant_context Dependency`  [INFERRED] [semantically similar]
  server/docs/AI-DEVELOPMENT-RULES.md → docs/adr/ADR-014-tenant-context-resolution.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Tenant Isolation Enforcement across Postgres, Redis, Qdrant, Events** — client_docs_ai_development_rules_tenantawaremixin, client_docs_ai_development_rules_redismanager_build_tenant_key, client_docs_ai_development_rules_qdrantmanager_build_tenant_filter, client_docs_ai_development_rules_get_current_tenant_id, walkthrough_build_tenant_event_envelope, client_docs_security_tenant_data_isolation [INFERRED 0.85]
- **app/algorithms DSA Toolkit** — client_docs_dsa_algorithms_priorityqueue, client_docs_dsa_algorithms_tokenbucket, client_docs_dsa_algorithms_lruttlcache, client_docs_dsa_algorithms_bloomfilter [EXTRACTED 1.00]
- **Asynchronous Email Ingestion & AI Processing Flow** — client_docs_architecture_fastapi_api_gateway, client_docs_event_architecture_redis_streams_event_bus, client_docs_architecture_email_worker, client_docs_architecture_ai_worker, client_docs_ai_architecture_modular_ai_processing_pipeline, client_docs_rag_architecture_retrieval_orchestrator_workflow [INFERRED 0.85]
- **AI Email Reply Pipeline Contracts** — docs_ai_contracts_emailunderstandingresult, docs_ai_contracts_requirementplan, docs_ai_contracts_evidenceattribution, docs_ai_contracts_responsedraft, docs_ai_contracts_responsevalidationresult, docs_ai_contracts_humanreviewtrigger [EXTRACTED 1.00]
- **Novelty-Aware Continuation Flow** — docs_conversation_aware_novelty_retrieval_implementation_and_audit_deterministic_continuation_fast_path, docs_conversation_aware_novelty_retrieval_implementation_and_audit_presentation_tracker, docs_conversation_aware_novelty_retrieval_implementation_and_audit_retrieval_router, docs_conversation_aware_novelty_retrieval_implementation_and_audit_structured_retriever, docs_conversation_aware_novelty_retrieval_implementation_and_audit_semantic_retriever, docs_conversation_aware_novelty_retrieval_implementation_and_audit_verify_novelty_invariant, docs_conversation_aware_novelty_retrieval_implementation_and_audit_threadpresentedentity [EXTRACTED 1.00]
- **Tenant-Scoped Data Access Helpers** — docs_ai_development_rules_tenantawaremixin, docs_ai_development_rules_redismanager_build_tenant_key, docs_ai_development_rules_qdrantmanager_build_tenant_filter, client_docs_adr_adr_005_multi_tenancy_get_current_tenant_id [INFERRED 0.85]
- **Gmail ingestion, sync, and self-healing recovery pipeline** — docs_gmail_pubsub_architecture_pub_sub_ingestion_flow, docs_gmail_sync_architecture_incremental_history_sync, docs_gmail_sync_architecture_http_404_cursor_expiration_fallback, docs_gmail_recovery_architecture_30_day_downtime_recovery_workflow, docs_gmail_watch_renewal_min_heap_priority_queue_watch_scheduler, docs_gmail_sync_architecture_distributed_sync_lock [INFERRED 0.85]
- **Email pipeline latency remediations** — docs_email_pipeline_latency_root_cause_and_remediation_report_reasoning_effort_low_pinning, docs_email_pipeline_latency_root_cause_and_remediation_report_deterministic_claim_normalization, docs_email_pipeline_latency_root_cause_and_remediation_report_deterministic_intent_fast_path, docs_email_pipeline_latency_root_cause_and_remediation_report_single_roundtrip_incremental_gmail_sync, docs_email_pipeline_latency_root_cause_and_remediation_report_get_current_items_batch, docs_email_pipeline_latency_root_cause_and_remediation_report_outbox_race_condition_fix, docs_email_pipeline_latency_root_cause_and_remediation_report_outbound_delivery_streamlining [EXTRACTED 1.00]
- **Knowledge canonical data model** — docs_knowledge_architecture_knowledgeitem, docs_knowledge_architecture_knowledgeversion, docs_knowledge_architecture_knowledgesource, docs_knowledge_architecture_knowledgeattribute_typed_storage, docs_knowledge_category_schemas_knowledgeattributedefinition [INFERRED 0.85]
- **Knowledge Import Pipeline Stages (Upload, Parse, Profile, Detect, Validate)** — docs_knowledge_file_storage_upload_endpoint_knowledge_imports_upload, docs_knowledge_parser_architecture_datasetprofiler, docs_knowledge_dataset_profiling_columnaccumulator, docs_knowledge_schema_detection_compiledmappingplandto, docs_knowledge_data_validation_rowqualityservice, docs_knowledge_import_architecture_knowledgeimportworker [INFERRED 0.85]
- **Core Knowledge Relational Entities** — docs_knowledge_data_contracts_knowledgesource_entity, docs_knowledge_data_contracts_knowledgeitem_entity, docs_knowledge_data_contracts_knowledgeversion_entity, docs_knowledge_data_contracts_knowledgeattribute_entity [EXTRACTED 1.00]
- **Compile-Once Schema Plan Pattern** — docs_knowledge_flexible_schema_engine_compiledschemaplan, docs_knowledge_schema_detection_compiledmappingplandto, docs_knowledge_normalization_compiledrowextractor, docs_knowledge_flexible_schema_engine_knowledgeschemaprofile [INFERRED 0.85]
- **Incoming Email AI Pipeline Stages (Context -> Plan -> Retrieval -> Fusion -> Reply)** — docs_phase_10_1_final_report_conversationcontextresolver, docs_phase_10_1_final_report_contextenvelope, docs_phase_3_requirement_intent_planner_implementation_and_audit_requirementplan, docs_phase_4_tenant_scoped_retrieval_router_implementation_and_audit_retrievalrouter, docs_phase_4_tenant_scoped_retrieval_router_implementation_and_audit_retrievalresult, docs_phase_5_candidate_fusion_evidence_verification_implementation_and_audit_evidencefusionservice, docs_phase_5_candidate_fusion_evidence_verification_implementation_and_audit_verifiedevidenceresult, docs_phase_7_reply_planning_validation_implementation_and_audit_replyplannerservice, docs_phase_7_reply_planning_validation_implementation_and_audit_replyplan [EXTRACTED 1.00]
- **Gmail Ingress Durability Pattern (OIDC, provider_events, outbox, stream, coalescing)** — docs_phase_10_0_event_contract_oidc_jwt_verification, docs_phase_10_0_event_contract_provider_events, docs_phase_10_0_event_contract_outbox_events, docs_phase_10_0_event_contract_email_events_stream, docs_phase_10_0_event_contract_account_sync_lock, docs_phase_10_0_event_contract_coalescing_watermark, docs_phase_10_0_event_contract_email_persistence_idempotency [EXTRACTED 1.00]
- **Tenant Authorization Chain (membership, context, permission, scoped query)** — docs_membership_architecture_organization_members, docs_knowledge_tenant_isolation_get_tenant_context, docs_knowledge_tenant_isolation_require_permission, docs_knowledge_tenant_isolation_knowledgecrudservice, docs_membership_architecture_organization_switching [INFERRED 0.85]
- **Tenant isolation enforced across Postgres, Redis, Qdrant, events** — docs_tenant_scoping_enforce_tenant_query, docs_tenant_scoping_redis_tenant_namespace, docs_tenant_scoping_assert_qdrant_filter_has_tenant, docs_tenant_scoping_canonical_event_envelope, docs_security_tenantawaremixin, docs_adr_adr_008_tenant_isolation_contract_multi_tenant_isolation_contract [INFERRED 0.85]
- **Tenant context request resolution flow** — docs_tenant_context_get_current_user, docs_tenant_context_get_tenant_context, docs_tenant_context_tenantcontext, docs_tenant_context_require_permission, docs_rbac_architecture_authorizationservice, docs_adr_adr_012_organization_membership_model_organization_members [INFERRED 0.85]
- **PostgreSQL authoritative with Qdrant as downstream semantic projection** — docs_adr_adr_006_postgresql_source_of_truth_postgresql_source_of_truth, docs_adr_adr_007_qdrant_knowledge_layer_qdrant_ephemeral_retrieval_layer, docs_adr_adr_003_vector_database_qdrant, docs_rag_contracts_hybrid_knowledge_architecture, docs_rag_contracts_knowledge_versions [INFERRED 0.85]
- **Multi-Tenant Isolation Enforcement Across Stores** — docs_adr_adr_018_tenant_data_isolation_postgresql_organization_id_scoping, docs_adr_adr_018_tenant_data_isolation_tenant_redis_key_namespace, docs_adr_adr_018_tenant_data_isolation_mandatory_qdrant_tenant_fieldcondition, docs_adr_adr_018_tenant_data_isolation_event_envelope_organization_id_header, server_docs_ai_development_rules_redismanager_build_tenant_key, server_docs_ai_development_rules_qdrantmanager_build_tenant_filter, docs_adr_adr_020_tenant_isolation_testing_tenantscopingerror [INFERRED 0.85]
- **Tenant Request Authorization Flow** — docs_adr_adr_014_tenant_context_resolution_get_tenant_context_dependency, docs_adr_adr_017_tenant_resolution_strategy_canonical_tenant_context_chain, docs_adr_adr_017_tenant_resolution_strategy_tenantcontext, docs_adr_adr_013_role_permission_model_authorizationservice, docs_adr_adr_013_role_permission_model_three_table_rbac_model [INFERRED 0.85]
- **Email Ingress and Context Resolution Pipeline** — docs_engineering_audit_baseline_two_phase_gmail_synchronization, docs_engineering_audit_baseline_emailfilterservice, docs_engineering_audit_baseline_transactional_outbox_pattern, docs_engineering_audit_baseline_email_events_redis_stream, docs_engineering_audit_baseline_conversation_context_resolver, docs_engineering_audit_baseline_contextenvelope [EXTRACTED 1.00]
- **Knowledge Ingestion to Vector Index Pipeline** — server_docs_knowledge_persistence_knowledgepersistenceservice, server_docs_knowledge_semantic_projection_knowledgeprojectionservice, server_docs_knowledge_semantic_projection_knowledge_semantic_projection_ready_event, server_docs_embedding_architecture_knowledgeembeddingworker, server_docs_qdrant_knowledge_schema_shared_proxipilot_knowledge_collection [INFERRED 0.85]
- **Email Evidence-to-Reply Flow** — server_docs_enterprise_multi_category_knowledge_ingestion_and_rag_optimization_report_multiintentdecomposer, server_docs_enterprise_multi_category_knowledge_ingestion_and_rag_optimization_report_multi_category_structured_retrieval_branch, server_docs_enterprise_multi_category_knowledge_ingestion_and_rag_optimization_report_per_requirement_evidencegrouper, server_docs_phase_6_minimal_evidence_package_implementation_and_audit_minimalevidencepackage_contract, server_docs_email_pipeline_latency_root_cause_and_remediation_report_reply_drafter_drafter_py [INFERRED 0.85]
- **Multi-Layer Tenant Isolation Enforcement** — server_docs_security_tenant_data_isolation, server_docs_security_redismanager_build_tenant_key, server_docs_rag_architecture_qdrantmanager_build_tenant_filter, server_docs_qdrant_knowledge_schema_assert_qdrant_filter_has_tenant, server_docs_knowledge_persistence_tenant_derivation_from_importjob, server_docs_security_jwt_derived_tenant_resolution [INFERRED 0.85]
- **Tenant Isolation Across Auth and Storage Layers** — server_docs_adr_adr_005_multi_tenancy_token_derived_tenant_resolution, server_docs_adr_adr_005_multi_tenancy_get_current_tenant_id, server_docs_adr_adr_003_vector_database_tenant_metadata_isolation, server_docs_adr_adr_002_database_postgresql [INFERRED 0.75]
- **Create Next App Default Public Assets** — client_public_file_file_icon, client_public_globe_globe_icon, client_public_next_next_js_logo, client_public_vercel_vercel_logo, client_public_window_window_icon [INFERRED 0.85]

## Communities (233 total, 39 thin omitted)

### Community 0 - "Reply Planner & Drafts"
Cohesion: 0.03
Nodes (49): ContextualReference, EvidenceFactType, FactTemporalStatus, MinimalEvidencePackage, MissingInformationSignal, MissingSignalType, PackageActionContext, PackageBudgetMetrics (+41 more)

### Community 1 - "Evidence Fusion & Verification"
Cohesion: 0.04
Nodes (56): ActionWorkflowContext, CandidateRole, ConflictRecord, EvidenceOverallStatus, RequirementCoverageStatus, RequirementEvidenceGroup, RequirementType, VerifiedCandidate (+48 more)

### Community 2 - "Requirement Intent Planner"
Cohesion: 0.03
Nodes (43): Ambiguity, EntityResolutionStatus, EvidenceReference, IntentType, MissingDetail, PlanMetadata, PlannedFilter, PlannedResultCount (+35 more)

### Community 3 - "Integration Account Core"
Cohesion: 0.04
Nodes (24): list_integrations(), handle_gmail_pubsub_push(), PubSubMessagePayload, PubSubPushEnvelope, _resolve_account_info(), apply_dns_patch(), resilient_getaddrinfo(), resolve_ipv4_addresses() (+16 more)

### Community 4 - "Organizations & Onboarding Models"
Cohesion: 0.04
Nodes (31): create_organization(), get_organization(), get_organization_context(), list_organizations(), update_organization(), OnboardingStateResponse, MembershipResponse, OrganizationContextResponse (+23 more)

### Community 5 - "Gmail Sync & Inbox Models"
Cohesion: 0.04
Nodes (32): get_db(), EmailMessage, EmailThread, LeadIntent, MessageDirection, ThreadStatus, CursorSyncState, EmailCategory (+24 more)

### Community 6 - "Auth Service & Sessions"
Cohesion: 0.05
Nodes (28): get_me(), resend_otp(), signin(), signout(), signup(), verify_otp(), ResendOtpRequest, ResendOtpResponse (+20 more)

### Community 7 - "Row Quality & Data Pipeline"
Cohesion: 0.04
Nodes (24): CategoryIdentityResolver, _normalize_identity_token(), ColumnMappingDTO, CompiledMappingPlanDTO, BatchQualityResultDTO, DatasetQualitySummaryDTO, NormalizedRecordDTO, QualityRowStatus (+16 more)

### Community 8 - "Dataset Profiling & Column Mapping"
Cohesion: 0.04
Nodes (15): BoundedCardinalityEstimator, CellTypeObservation, TypeInferenceEngine, ColumnProfileDTO, DatasetProfileDTO, FileParserMetadataDTO, QualitySummaryDTO, ColumnMappingService (+7 more)

### Community 9 - "Frontend Knowledge Module"
Cohesion: 0.06
Nodes (64): EmptyState(), FetchErrorBanner(), KnowledgeContent(), KnowledgePage(), TableSkeleton(), AddKnowledgeDialog(), AddKnowledgeModalContent(), CATEGORY_OPTIONS (+56 more)

### Community 10 - "Gmail Ingestion & Outbox Relay"
Cohesion: 0.05
Nodes (27): google_callback(), google_login(), microsoft_callback(), microsoft_login(), invalidate_account_cache(), OutboxEvent, OutboxStatus, OutboxService (+19 more)

### Community 11 - "ORM Base & Tenant Mixin"
Cohesion: 0.05
Nodes (23): AIPipelineStage, AIResponse, AIRun, AIRunStatus, Evidence, EvidenceSourceType, ResponseApprovalStatus, Base (+15 more)

### Community 12 - "Flexible Schema API"
Cohesion: 0.06
Nodes (32): compile_schema_plan(), detect_schema(), list_schema_profiles(), normalize_preview(), save_schema_profile(), BatchNormalizationResult, coerce_array(), coerce_boolean() (+24 more)

### Community 13 - "Knowledge Persistence Service"
Cohesion: 0.04
Nodes (24): Datasets A/B/C Flexible Schema Tests, Flexible Schema Ingestion Test Results, PersistenceOutcome.UNCHANGED Idempotency, test_flexible_schema_ingestion_datasets_a_b_c, Acceptance Gates 1-8, Asymmetric commercial_price_type Defect, _is_canonical_identical, Knowledge System Remaining Issues Audit (+16 more)

### Community 14 - "Landing Page Layout"
Cohesion: 0.11
Nodes (48): metadata, RootLandingPage(), AIControlSection(), AIIntelligenceSection(), AnalyticsSection(), FadeUp(), FinalCtaCanvas(), FAQSection() (+40 more)

### Community 15 - "Knowledge Import Worker & Parser"
Cohesion: 0.05
Nodes (18): ParserErrorType, ImportJobStage, ImportJobStatus, KnowledgeLifecycleStatus, KnowledgeSourceStatus, KnowledgeSourceType, SourceAuthorityLevel, CsvStreamParser (+10 more)

### Community 16 - "Flexible Schema Engine"
Cohesion: 0.05
Nodes (12): CompiledFieldPlan, CompiledSchemaPlan, compute_schema_fingerprint(), FieldMappingDTO, RowValidationError, sanitize_attribute_key(), CanonicalFieldDefinition, normalize_category_key() (+4 more)

### Community 17 - "Embedding Providers"
Cohesion: 0.06
Nodes (13): EmbeddingBatchRequest, EmbeddingBatchResult, EmbeddingRequestItem, EmbeddingResultItem, CohereEmbeddingProvider, _l2_normalize(), LocalDeterministicEmbeddingProvider, OpenAIEmbeddingProvider (+5 more)

### Community 18 - "Knowledge Sources"
Cohesion: 0.07
Nodes (15): create_knowledge_source(), delete_knowledge_source(), get_knowledge_source(), get_knowledge_source_lineage(), list_knowledge_sources(), update_knowledge_source(), KnowledgeSourceCreateDTO, KnowledgeSourceCursorPageDTO (+7 more)

### Community 19 - "File Storage Providers"
Cohesion: 0.04
Nodes (6): FileStorageProvider, get_storage_provider(), LocalStorageProvider, LocalUploadSession, UploadSession, StorageCleanupService

### Community 20 - "Knowledge Import Jobs"
Cohesion: 0.07
Nodes (14): cancel_import_job(), cleanup_stale_uploads(), create_import_job(), get_import_job(), list_import_jobs(), upload_knowledge_file(), FileUploadResponseDTO, ImportJobCancelDTO (+6 more)

### Community 21 - "Integrations UI"
Cohesion: 0.09
Nodes (40): GmailAccountDetailPage(), IntegrationsContent(), IntegrationsPage(), OAuthSuccessBanner(), OAuthSuccessBannerProps, ComingSoonCard(), ComingSoonCardProps, ComingSoonGrid() (+32 more)

### Community 22 - "Knowledge CRUD Service"
Cohesion: 0.08
Nodes (9): decode_cursor(), encode_cursor(), KnowledgeCursorPageDTO, KnowledgeItemCreateDTO, KnowledgeItemResponseDTO, KnowledgeItemUpdateDTO, KnowledgeVersionHistoryDTO, KnowledgeCRUDService (+1 more)

### Community 23 - "Inbox API Routes"
Cohesion: 0.07
Nodes (26): AISummaryDTO, _decode_message_cursor(), _decode_thread_cursor(), delete_thread(), _encode_message_cursor(), _encode_thread_cursor(), get_thread(), LeadTemperatureRequest (+18 more)

### Community 24 - "Dashboard Overview UI"
Cohesion: 0.06
Nodes (35): AnalyticsPage(), metadata, AutomationsPage(), metadata, BillingPage(), metadata, CampaignsPage(), metadata (+27 more)

### Community 25 - "Onboarding API"
Cohesion: 0.07
Nodes (15): get_activation_status(), get_business_profile(), get_onboarding_state(), get_workspace_preferences(), save_business_profile(), save_workspace_preferences(), BusinessProfileCreateUpdateRequest, BusinessProfileResponse (+7 more)

### Community 26 - "Hybrid Retrieval Service"
Cohesion: 0.07
Nodes (19): AuthoritativeEvidenceObject, AuthoritativePricingEvidence, CommercialPriceType, EvidenceRecord, HybridRetrievalRequestDTO, HybridRetrievalResponseDTO, QdrantVectorPayload, RequirementValidationResult (+11 more)

### Community 27 - "App Configuration Settings"
Cohesion: 0.05
Nodes (19): AiWorkerSettings, ApiSettings, AuthSettings, AutomationWorkerSettings, BaseAppConfig, DatabaseSettings, EmailProviderSettings, EmailWorkerSettings (+11 more)

### Community 28 - "Alembic Migrations"
Cohesion: 0.07
Nodes (21): downgrade(), upgrade(), downgrade(), upgrade(), upgrade(), downgrade(), upgrade(), upgrade() (+13 more)

### Community 29 - "Embedding Pipeline & Reconciliation"
Cohesion: 0.08
Nodes (9): EmbeddingDtype, EmbeddingInputType, EmbeddingProvider, KnowledgeVectorPayload, NormalizationPolicy, EmbeddingProfileMismatchError, get_embedding_provider(), EmbeddingPipelineService (+1 more)

### Community 30 - "Knowledge Projection & Embedding Worker"
Cohesion: 0.06
Nodes (9): EventNames, SemanticDocumentDTO, get_ai_worker_settings(), KnowledgeSemanticChunk, EmbeddingPipelineMetrics, KnowledgeProjectionService, KnowledgeEmbeddingWorker, reconcile_and_resync() (+1 more)

### Community 31 - "Retrieval Router Benchmarks"
Cohesion: 0.06
Nodes (10): RetrievalResult, SourceExecutionMetadata, KnowledgeCategory, RetrievalRouter, SemanticCandidateHit, RetrievalRouterService, MockFastSemanticRetriever, MockFastStructuredRetriever (+2 more)

### Community 32 - "Evidence Package Selector"
Cohesion: 0.09
Nodes (10): EvidenceExcerpt, RequirementPlan, get_event_bus(), ContextEnvelope, EvidenceMinimizer, EvidenceSelector, MinimalEvidencePackageService, PackageConsistencyValidator (+2 more)

### Community 33 - "Retrieval Router Tests"
Cohesion: 0.08
Nodes (18): PlannedEntity, RetrievalStatus, RetrievalStrategyUsed, test_evidence_fusion_held_out_accuracy_benchmark(), test_cross_tenant_plan_rejection(), test_embedding_profile_consistency_and_mismatch(), _build_evaluation_dataset(), EvaluationCase (+10 more)

### Community 34 - "Registration Auth Forms"
Cohesion: 0.11
Nodes (29): BusinessPage(), metadata, metadata, OrganizationPage(), metadata, SignupPage(), metadata, WorkspacePage() (+21 more)

### Community 35 - "Frontend Providers & Stores"
Cohesion: 0.07
Nodes (31): zustand@^5.0.15, caveat, inter, metadata, RootLayout(), ToastContainer(), TenantContext, TenantContextValue (+23 more)

### Community 36 - "Onboarding Step Forms & Hooks"
Cohesion: 0.07
Nodes (31): SERVED_INDUSTRIES, STEP_ORDER, AI_STYLES, STEP_URL_MAP, TIMEZONES, CustomSelect(), CustomSelectOption, CustomSelectProps (+23 more)

### Community 37 - "Knowledge Service & Attributes"
Cohesion: 0.09
Nodes (12): validate_record(), CategoryFieldSchemaDTO, CategorySummaryDTO, CustomAttributeCreateDTO, CustomAttributeResponseDTO, KnowledgeCategoryError, KnowledgeInvalidCategoryError, KnowledgeValidationError (+4 more)

### Community 38 - "Knowledge API Routes"
Cohesion: 0.06
Nodes (17): create_custom_attribute(), create_knowledge_item(), delete_knowledge_item(), get_category(), get_knowledge_item(), get_knowledge_stats(), get_knowledge_version(), get_knowledge_version_diff() (+9 more)

### Community 39 - "Landing Problem Section"
Cohesion: 0.08
Nodes (21): DeleteConfirmDialogProps, AFTER_EMAILS, AfterEmailItem, AfterInboxCard(), TABS, BEFORE_EMAILS, BeforeEmailItem, BeforeInboxCard() (+13 more)

### Community 40 - "Frontend API Client & Errors"
Cohesion: 0.12
Nodes (16): ApiClient, apiClient, BackendIntegrationAccount, ConnectGmailResponse, IntegrationHealthResponse, ApiResponse, HttpMethod, PaginatedResponse (+8 more)

### Community 41 - "Multi-Intent Decomposer"
Cohesion: 0.09
Nodes (7): PlannedRange, PlannedRequirement, RequirementGroupDefinition, RequirementGrouper, MultiIntentDecomposer, TestMultiIntentDecomposition, _build_synthetic_plan()

### Community 42 - "Knowledge Category Projectors"
Cohesion: 0.16
Nodes (16): KnowledgeItem, KnowledgeVersion, _BaseCategoryProjector, _BrandCommunicationProjector, _CompanyInfoProjector, _ContactsProjector, _format_currency_amount(), _format_value() (+8 more)

### Community 43 - "Email Parser"
Cohesion: 0.07
Nodes (12): _decode_header_value(), EmailParser, _extract_charset(), _gmail_payload_to_raw_bytes(), _html_to_plain_text(), _is_quote_header(), normalize_body_text(), normalize_subject() (+4 more)

### Community 44 - "Integrations API Routes"
Cohesion: 0.10
Nodes (14): AutomationToggleRequest, _build_frontend_redirect_url(), connect_gmail(), ConnectUrlResponse, disconnect_gmail(), get_account_automation(), get_integration_health(), gmail_oauth_callback() (+6 more)

### Community 45 - "Embedding Profiles & Crypto"
Cohesion: 0.07
Nodes (6): EmbeddingSettings, get_settings(), LlmSettings, CredentialEncryption, EmbeddingProfile, EmbeddingProfileRegistry

### Community 46 - "Knowledge Category Registry"
Cohesion: 0.09
Nodes (9): CategoryDefinition, KnowledgeCategoryRegistry, normalize_boolean(), normalize_currency(), normalize_email(), normalize_number(), normalize_phone(), normalize_string() (+1 more)

### Community 47 - "Structured Retriever & Read Contract"
Cohesion: 0.11
Nodes (6): build_current_version_filter(), CanonicalKnowledgeReader, compute_temporal_status(), normalize_utc_timestamp(), _extract_numeric_price(), StructuredRetriever

### Community 48 - "App Shell Navigation"
Cohesion: 0.12
Nodes (24): nextConfig, DashboardLayout(), metadata, AppShell(), AppShellProps, AppSidebar(), AppSidebarProps, BOTTOM_NAV (+16 more)

### Community 49 - "Scroll Animation Primitives"
Cohesion: 0.11
Nodes (20): GlobalErrorProps, SubroutePlaceholderProps, FadeIn(), FadeInProps, FadeUpProps, ScaleIn(), ScaleInProps, Stagger() (+12 more)

### Community 50 - "Range & Price Extraction"
Cohesion: 0.07
Nodes (7): ExtractedBillingPeriod, ExtractedCount, ExtractedDiscount, ExtractedIdentifier, ExtractedPrice, ExtractedRange, ExtractedSpan

### Community 51 - "Client Dependencies"
Cohesion: 0.08
Nodes (32): dependencies, clsx@^2.1.1, @emotion/react@^11.14.0, @emotion/styled@^11.14.1, @hookform/resolvers@^5.9.1, motion@^14.0.0, @mui/icons-material@^9.4.0, @mui/material@^9.4.0 (+24 more)

### Community 52 - "App Entrypoint & CLI"
Cohesion: 0.08
Nodes (11): censor_sensitive_data(), setup_logging(), create_app(), standardized_http_exception_handler(), lifespan(), _status_to_error_code(), KnowledgeAttribute, main() (+3 more)

### Community 53 - "Pub/Sub Auth Verification"
Cohesion: 0.11
Nodes (10): GooglePubSubAuthVerifier, _build_test_verifier(), _generate_test_token(), test_expired_token_rejected(), test_invalid_issuer_rejected(), test_mismatched_audience_rejected(), test_mismatched_service_account_rejected(), test_missing_or_malformed_auth_header_rejected() (+2 more)

### Community 54 - "AI Contracts & Enums"
Cohesion: 0.09
Nodes (13): ConfidenceScore, EmailUnderstandingInput, EmailUnderstandingResult, IntentCategory, IntentExtractionInput, IntentExtractionResult, LeadTemperature, PolicyValidationResult (+5 more)

### Community 55 - "Version Diff Engine"
Cohesion: 0.10
Nodes (8): ErrorResponse, FieldDiffDTO, PublishVersionRequestDTO, RollbackRequestDTO, VersionDiffDTO, _normalize_cmp_value(), _values_are_equal(), VersionDiffEngine

### Community 56 - "Tenant, Membership & Onboarding Docs"
Cohesion: 0.10
Nodes (24): Knowledge Multi-Tenant Isolation & IDOR Defense (Phase 7.3), get_tenant_context(), ix_knowledge_items_tenant_created index, KnowledgeCRUDService, Knowledge RBAC Permission Matrix, require_permission(), Membership Architecture & Lifecycle, ix_org_member_lookup index (+16 more)

### Community 57 - "Gmail API Client"
Cohesion: 0.10
Nodes (3): GmailApiException, _fetch_one(), GmailRateLimitException

### Community 58 - "Frontend Inbox Service"
Cohesion: 0.11
Nodes (19): AVATAR_PALETTES, BackendAISummary, BackendMessage, BackendPaginatedMessages, BackendPaginatedThreads, BackendSender, BackendThread, _buildSender() (+11 more)

### Community 59 - "Hero Pipeline Visual"
Cohesion: 0.18
Nodes (18): DraftResponseCard(), DraftResponseCardProps, FeatureStrip(), BottomRightNote(), TopLeftNote(), TopRightNote(), HeroPipelineVisual(), IncomingEmailsCard() (+10 more)

### Community 60 - "Frontend Architecture Docs"
Cohesion: 0.09
Nodes (21): Centralized apiClient, Forbidden Frontend Patterns, Frontend Architecture Specification, Frontend RBAC can() Helper, Frontend Technology Stack, Styling and Design System Rules, TanStack Query, Zustand (+13 more)

### Community 61 - "Audit Events & Retention"
Cohesion: 0.13
Nodes (5): AuditAction, AuditActorType, AuditEvent, AuditService, sanitize_audit_metadata()

### Community 62 - "Bento Grid UI & Utils"
Cohesion: 0.11
Nodes (7): BentoGrid(), BentoGridItem(), BentoGridThirdDemo(), items, ClassValue, cn(), SanitizeOptions

### Community 63 - "Semantic Chunker"
Cohesion: 0.10
Nodes (4): ProjectionBatchSummaryDTO, SemanticChunkDTO, SemanticMetadataDTO, SemanticChunker

### Community 64 - "Qdrant Client Manager"
Cohesion: 0.11
Nodes (3): QdrantSettings, get_qdrant(), QdrantManager

### Community 65 - "Tenant Scoping Utilities"
Cohesion: 0.12
Nodes (10): DomainEventEnvelope, assert_qdrant_filter_has_tenant(), build_qdrant_tenant_filter(), build_tenant_event_envelope(), enforce_tenant_query(), TenantScopingError, build_qdrant_tenant_filter, build_tenant_cache_key (+2 more)

### Community 66 - "Conversation Context Resolver"
Cohesion: 0.11
Nodes (4): ConversationContextResolver, OptimisticLockException, RequirementStatus, ThreadSummaryState

### Community 67 - "Registration Shell UI"
Cohesion: 0.11
Nodes (19): RegistrationBrandPanel(), RegistrationBrandPanelProps, ONBOARDING_STEPS, RegistrationProgress(), RegistrationProgressProps, StepItem, RegistrationRouteGuardProps, RegistrationShellProps (+11 more)

### Community 68 - "Schema Detection & Mapping Docs"
Cohesion: 0.10
Nodes (20): Category-Aware Constraint Validation, Data Quality & Row Validation Architecture (Phase 8.4), Profiling Schema Fingerprint, Category-Aware Canonical Field Aliases, CompiledSchemaPlan, Engine Schema Fingerprint, Flexible Schema Engine Architecture (Phase 7.2), KnowledgeSchemaProfile (+12 more)

### Community 69 - "Email Filter Classification"
Cohesion: 0.12
Nodes (5): ClassificationResult, EmailFilterService, _extract_domain(), _extract_email_addr(), _is_domain_match()

### Community 70 - "Engineering Audit Baseline"
Cohesion: 0.16
Nodes (6): Repository Engineering Baseline Assessment, ContextEnvelope, EmailFilterService, ChatGPT Engineering Consultation Log, Architectural Decisions Record (Engineering Audit), Verification & Testing Log

### Community 71 - "Authorization Service (RBAC)"
Cohesion: 0.12
Nodes (3): AuthorizationError, AuthorizationService, TenantMismatchError

### Community 72 - "Frontend Logging & Analytics"
Cohesion: 0.14
Nodes (9): ErrorProps, analytics, AnalyticsEvent, AnalyticsService, track(), Logger, logger, LogLevel (+1 more)

### Community 73 - "Phase 10.1 Context Resolver Docs"
Cohesion: 0.15
Nodes (20): Conversation Context Resolver, Phase 10.1 Context Resolver Audit, email_threads Schema Migration (context_revision etc.), EmailParser, Root Cause: Hardcoded filter_reason=ACCEPT, Multi-Signal Classification Engine, Pre-Persistence Suppression Gate, Root Cause: Premature EmailThread Upsert (+12 more)

### Community 75 - "Setup & Scaling Docs"
Cohesion: 0.12
Nodes (14): ADR-001: Event Bus - Redis Streams, EventBus abstract interface (app/core/messaging.py), Redis Streams Event Bus, ADR-004: Modular Monolith with Scalable Workers, ADR-011: Modular Monolith vs Microservices, proxipilot:stream:ai_processing, Horizontal Scaling Roadmap, Backend Stack (FastAPI, SQLAlchemy 2.0, Redis Streams, Qdrant) (+6 more)

### Community 76 - "Dashboard & App Shell Docs"
Cohesion: 0.12
Nodes (19): Authenticated App Shell, AppShell, CommandPalette, Organization Switcher, Sidebar Navigation Groupings, Dashboard Architecture, AppShell, dashboard.store (+11 more)

### Community 77 - "Knowledge Data Contract Docs"
Cohesion: 0.14
Nodes (17): AttributeValueType Enum, Knowledge Data Contracts (Phase 7.0), KnowledgeAttribute Entity, KnowledgeCategory Taxonomy, KnowledgeItem Entity, KnowledgeLifecycleStatus Enum, KnowledgeSource Entity, KnowledgeSourceType Enum (+9 more)

### Community 78 - "Client Frontend & Security Docs"
Cohesion: 0.11
Nodes (14): apiClient, AppError, can() RBAC Helper, Frontend Architecture Specification, Frontend Technology Stack, React Hook Form + Zod, sanitizeUntrustedHtml, TanStack Query (+6 more)

### Community 79 - "Client TS Config"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 80 - "Canonical Data Contract Docs"
Cohesion: 0.17
Nodes (18): Business Profile Architecture, Business Profile Cache Invalidation, BusinessProfile, Canonical Data Contracts, ai_responses table, ai_runs table, business_entities table, business_profiles table (+10 more)

### Community 81 - "Retrieval Router Phase 4 Docs"
Cohesion: 0.18
Nodes (16): email.requirement_plan.created event, CanonicalKnowledgeReader, _compute_exact_pricing (Decimal), Phase 4 Tenant-Scoped Retrieval Router Report, email.retrieval.completed event, EmbeddingProfileRegistry, FactVerifier, Qdrant Mandatory Tenant Filter (+8 more)

### Community 82 - "Multi-Category Ingestion Benchmark"
Cohesion: 0.18
Nodes (3): MappingReason, MappingTargetKind, test_run_comprehensive_enterprise_benchmarks()

### Community 83 - "Tenant Scoping & Envelope Docs"
Cohesion: 0.15
Nodes (15): ADR-008: Multi-Tenant Data Isolation Contract, ADR-009: Universal Event Envelope, Universal Event Envelope, RedisManager.build_tenant_key, Canonical Event Envelope (organization_id), Dead-Letter Queue, Multi-Tenant Scoping Architecture, enforce_tenant_query (+7 more)

### Community 84 - "Tenant Isolation Rules Docs"
Cohesion: 0.20
Nodes (12): ADR-018: Multi-Tenant Data Isolation Across Persistence and Streaming, ADR-020: Automated Multi-Tenant Isolation & IDOR Verification, ProxiPilot AI Development Rules, event_bus.publish, QdrantManager.build_tenant_filter, RedisManager.build_tenant_key, TenantAwareMixin, ProxiPilot Algorithms & Data Structures Toolkit (+4 more)

### Community 85 - "Redis Manager & Locks"
Cohesion: 0.14
Nodes (3): get_redis(), RedisManager, build_tenant_cache_key()

### Community 86 - "Worker Base Classes"
Cohesion: 0.15
Nodes (3): get_automation_worker_settings(), AutomationWorker, BaseWorker

### Community 87 - "Server ADRs (DB, Vector, Tenancy)"
Cohesion: 0.13
Nodes (13): ADR-002: Relational Database & ORM, PostgreSQL (Neon Serverless), SQLAlchemy 2.0 + asyncpg, ADR-003: Vector Database, Company Knowledge Base Semantic Retrieval, Qdrant (qdrant-client async), Retrieval Query Planner, ADR-004: Background Processing / Worker Architecture (+5 more)

### Community 88 - "Qdrant Schema & RAG Docs"
Cohesion: 0.14
Nodes (18): Dolphy India Tenant Dataset, Knowledge Retrieval Contract (Phase 9.6), PostgreSQL Hydration and Validation, Qdrant Payload Contract, RAG Retrieval Flow, canonical_data JSONB Standard, Knowledge Storage Ownership and Sync Architecture, PostgreSQL as Source of Truth (+10 more)

### Community 89 - "Server Frontend & Security Docs"
Cohesion: 0.12
Nodes (17): Centralized apiClient, Five-Tier State Management, Frontend Architecture Specification, Frontend RBAC can() Helper, Next.js App Router, sanitizeUntrustedHtml, Tailwind CSS Prohibition, Correlation ID Propagation (+9 more)

### Community 90 - "Package"
Cohesion: 0.12
Nodes (16): eslintConfig, devDependencies, eslint@^9, eslint-config-next@16.3.5, prettier@^3.9.7, @types/node@^20, @types/react@^19, @types/react-dom@^19 (+8 more)

### Community 91 - "Knowledge Schemas"
Cohesion: 0.12
Nodes (14): zod@^4.6.5, baseKnowledgeSchema, brandCommunicationSchema, companyInfoSchema, contactSchema, faqSchema, locationSchema, offerSchema (+6 more)

### Community 92 - "Index"
Cohesion: 0.16
Nodes (9): breakpoints, colors, ColorToken, components, darkTheme, lightTheme, darkPalette, lightPalette (+1 more)

### Community 93 - "Knowledge Taxonomy"
Cohesion: 0.14
Nodes (14): brand_communication, business_profiles table, category_registry, company_info, contacts, Knowledge Taxonomy Specification (Phase 7.1), locations, normalize_category_key() (+6 more)

### Community 94 - "Phase 7 Reply Planning Validation Implem"
Cohesion: 0.21
Nodes (16): VerifiedEvidenceResult (schema 1.0), DeterministicReplyValidator, Phase 7 Reply Planning & Validation Report, Exact Price & Currency Verification, HumanReview Queue, MinimalEvidencePackage (Phase 6), Deterministic Outbound Idempotency Key, OutboundMessage (+8 more)

### Community 95 - "Verifier"
Cohesion: 0.15
Nodes (5): CoverageAssessment, FollowUpActions, VerificationAssessment, CandidateVerificationResult, FactVerifier

### Community 97 - "Email Pipeline Latency Root Cause And Re"
Cohesion: 0.17
Nodes (14): Deterministic Regex ID Sanitizer, Email Pipeline Latency Root-Cause and Remediation Report, gpt-5-mini, Reply Drafter (drafter.py), Requirement Planner Deterministic Fast Path, Webhook Sub-Stage Telemetry, Booking Confirmed False Safety Invariant, Evidence Package Minimizer (+6 more)

### Community 98 - "Performance"
Cohesion: 0.14
Nodes (10): ADR-003 Qdrant Vector Database, Algorithms & Data Structures Toolkit, LruTtlCache, PriorityQueue, TokenBucket, Latency Budgets, Layered Caching Hierarchy, Performance & Concurrency Architecture (+2 more)

### Community 99 - "Ai Architecture"
Cohesion: 0.16
Nodes (8): AI & LLM Engine Architecture, Hybrid Retrieval, Cost Optimization & Unit Economics, BloomFilter, Context Pruning, Query Planner, Reranker, Retrieval Orchestrator Workflow

### Community 100 - "Producttabswitcher"
Cohesion: 0.26
Nodes (11): ProductCockpitFrame(), Thread, THREADS, ProductBottomRightNote(), ProductTopLeftNote(), ProductShowcaseVisual(), ProductTab, ProductTabSwitcher() (+3 more)

### Community 101 - "Security"
Cohesion: 0.14
Nodes (10): ADR-005: Token-Derived Tenant Resolution, app.core.security.get_current_tenant_id, AuditService.record, Security Architecture Specification, 5-Role RBAC with can(role, action), Log Redaction (app/core/logging.py), sanitize_audit_metadata, Service-Scoped Settings (ApiSettings, AiWorkerSettings, EmailWorkerSettings) (+2 more)

### Community 102 - "Phase 5 Candidate Fusion Evidence Verifi"
Cohesion: 0.22
Nodes (10): Authority Precedence Hierarchy, CandidateNormalizer, ConflictRecord, ContextualReplyEvaluator, Phase 5 Candidate Fusion & Evidence Verification Report, email.evidence_fusion.completed event, EvidenceFactVerifier, EvidenceFusionService (+2 more)

### Community 103 - "File Validation"
Cohesion: 0.17
Nodes (3): detect_and_validate_file_type(), FileValidationError, secure_filename()

### Community 106 - "Ai Development Rules"
Cohesion: 0.16
Nodes (10): AI Development Rules, event_bus.publish, get_current_tenant_id, QdrantManager.build_tenant_filter, RedisManager.build_tenant_key, TenantAwareMixin, Connection Pooling Architecture, DatabaseManager (+2 more)

### Community 107 - "Tenant Resolution"
Cohesion: 0.17
Nodes (14): ADR-012: N:M Organization-Membership Model, organization_members join table (N:M), get_current_user, get_tenant_context, Composite index (user_id, organization_id, status), Request Lifecycle & Context Flow, TenantContext, Secure Tenant Resolution Architecture (+6 more)

### Community 108 - "Adr 013 Role Permission Model"
Cohesion: 0.20
Nodes (4): ADR-013: Extensible Role-Permission RBAC Model, ADR-014: Authoritative Server-Side Tenant Context Resolution, ADR-017: Tenant Resolution and Context Strategy, get_current_tenant_id

### Community 109 - "Backend Implementation Plan"
Cohesion: 0.14
Nodes (12): Audit Event Architecture, audit_events Schema, Canonical Action Taxonomy, sanitize_audit_metadata, Backend V1 Implementation Plan, AuditService.record, Database Ownership Matrix, KnowledgeItem / KnowledgeVersion Versioning (+4 more)

### Community 111 - "Event Architecture"
Cohesion: 0.18
Nodes (14): Abstract EventBus Interface, ADR-001 Event Bus Selection Redis Streams, Dead Letter Queue Strategy, DomainEvent Envelope, Event-Driven Messaging Architecture, Pending Entries List (PEL), Redis Streams Event Bus, Transactional Outbox Pattern (+6 more)

### Community 112 - "Knowledge Storage Audit"
Cohesion: 0.17
Nodes (14): Batched Atomic Transactions, external_identity_key Partial Unique Constraint, Import Worker Pipeline Stages, Knowledge Persistence Architecture (Phase 8.5), KnowledgePersistenceService, Record Persistence Outcomes, Tenant Derivation from ImportJob, business_entities Table Deprecation (+6 more)

### Community 113 - "Architecture"
Cohesion: 0.20
Nodes (12): AI Worker, Asynchronous Email Ingestion Path, Automation Worker, Backend Architecture, Cloudflare CDN/WAF, Email Worker, FastAPI API Gateway, Neon PostgreSQL (+4 more)

### Community 114 - "Page"
Cohesion: 0.27
Nodes (8): metadata, Page(), metadata, Page(), SigninAuthForm(), SignInPage(), SigninShowcasePanel(), SignInVisualStage()

### Community 115 - "Conversationlistitem"
Cohesion: 0.22
Nodes (9): ConversationListProps, Tab, TabId, ConversationListItem(), ConversationListItemProps, getAvatarStyle(), guessCategory(), TEMP_CHIP (+1 more)

### Community 116 - "Testimonialcarousel"
Cohesion: 0.29
Nodes (9): PILLARS, SocialPillarsGrid(), SocialProofVisualStage(), Testimonial, TestimonialCarousel(), TESTIMONIALS, BrandLogo, BRANDS (+1 more)

### Community 117 - "Rbac"
Cohesion: 0.16
Nodes (7): AppPermission, PERMISSIONS, PermissionSubject, Tenant, TenantMembership, UserProfile, UserRole

### Community 118 - "Rag Contracts"
Cohesion: 0.20
Nodes (9): ADR-003: Qdrant Vector Database, Qdrant Vector Database, ADR-007: Qdrant as Ephemeral Knowledge Layer, RAG & Retrieval Contracts, Evidence Attribution Layer, Hybrid Retrieval Request Contract, knowledge_versions table, Qdrant Point Payload Contract (+1 more)

### Community 119 - "Architecture 2"
Cohesion: 0.22
Nodes (14): Backend Architecture, AI Worker, Automation Worker, Email Worker, get_tenant_context, Neon PostgreSQL, OnboardingService, Path A: Async Email Ingestion & Processing (+6 more)

### Community 120 - "Knowledge Column Mapping"
Cohesion: 0.14
Nodes (13): Knowledge Future Phase Compatibility, Attribute Lifecycle and Deprecation, Explicit Null Semantics, Knowledge Attribute Domain Contract, Supported Attribute Types, KnowledgeAttributeDefinition, Column Mapping Engine Phase 8.3, ColumnMappingDTO (+5 more)

### Community 121 - "Phase 3 Requirement Intent Planner Imple"
Cohesion: 0.21
Nodes (12): ContextEnvelope, Stage 3 Requirement & Intent Planner Report, EmbeddingProfile contract, Hardcoded 1024 Query Dimension Bug, HybridRetrievalService, Layer A Deterministic Preprocessing, Layer B OpenAI Structured Intent Planner, Layer C Deterministic Validation & Policy Engine (+4 more)

### Community 123 - "Useinbox"
Cohesion: 0.36
Nodes (11): InboxContent(), InboxPage(), ConversationList(), DeleteConfirmDialog(), useConversationMessages(), useDeleteConversation(), useInfiniteConversations(), useMarkAsRead() (+3 more)

### Community 124 - "Conversation Aware Novelty Retrieval Imp"
Cohesion: 0.24
Nodes (11): Conversation-Aware Novelty Retrieval Audit, Adaptive Over-Fetching Formula, ContextEnvelope, Deterministic Continuation Fast Path, IntentType.MORE_OPTIONS, MinimalEvidencePackage, presentation_tracker, retrieval_router (+3 more)

### Community 125 - "Email Pipeline Latency Root Cause And Re 2"
Cohesion: 0.15
Nodes (9): Configuration Rollback Toggles, Correctness and Safety Invariants, get_current_items_batch, Latency Root-Cause and Remediation Report, Requirement Planner, Retrieval Router Verifier, Semantic Repair Retry Loop, Cross-Tenant IDOR Mitigation (+1 more)

### Community 126 - "Gmail Sync Architecture"
Cohesion: 0.17
Nodes (9): 30-Day Downtime Recovery Workflow, Full Sync Fallback on Expired Cursor, Gmail 30-Day Downtime Self-Healing Recovery, Distributed Sync Lock, Gmail Mailbox Synchronization Architecture, GmailHistoryExpiredException, HTTP 404 Cursor Expiration Fallback, Incremental History Sync (+1 more)

### Community 127 - "Phase 1 Infrastructure Audit"
Cohesion: 0.19
Nodes (13): Distributed Tracing & Correlation IDs, BaseWorker, Phase 1 Infrastructure Audit Report, DomainEvent, GAP-1 Missing Domain Models, GAP-10 passlib/bcrypt Dual Dependency, GAP-2 Missing Contract Files, GAP-5 Production Security Validator (+5 more)

### Community 128 - "Rbac Architecture"
Cohesion: 0.22
Nodes (11): AuthorizationService, RBAC Architecture, AuthorizationService.has_permission, RBAC Schema (roles, role_permissions, permissions), AuthorizationService.require, System Roles (OWNER, ADMIN, MEMBER), Tenant Custom Roles, V1 Role-Permission Matrix (+3 more)

### Community 130 - "Docker Compose"
Cohesion: 0.15
Nodes (12): command, env_file, environment, restart, volumes, services, ai-worker, version (+4 more)

### Community 131 - "Event Architecture 2"
Cohesion: 0.18
Nodes (9): ADR-001 Event Bus Selection Redis Streams, EventBus Interface, event_bus.send_to_dlq, Dead Letter Queue Strategy, DomainEvent, Event-Driven Messaging Architecture, Redis Streams Event Bus, Horizontal Scaling Roadmap (+1 more)

### Community 132 - "Adr 004 Worker Architecture"
Cohesion: 0.21
Nodes (8): ADR-004: Worker Architecture, app.main:app FastAPI HTTP Gateway, app.workers.cli Worker Runner, app.core.config Typed Settings, Backend Setup & Developer Guide, Alembic Async Migrations, Health/Ready/Metrics Probes, Unified Worker CLI Runner

### Community 134 - "Event Architecture 3"
Cohesion: 0.23
Nodes (10): At-Least-Once Delivery with Idempotent Consumers, Dead Letter Queue Strategy, DomainEvent, Event-Driven Messaging Architecture, Redis Streams Event Bus, Canonical Domain Event Catalog, Event Contracts and Event Bus, Event Invariant Rules (+2 more)

### Community 135 - "Gmail Oauth Architecture"
Cohesion: 0.18
Nodes (9): AES-256-GCM Token Encryption, Gmail Server-Side OAuth Architecture, Zero Secret Leakage, Gmail Pub/Sub Webhook Architecture, Pub/Sub Ingestion Flow, AES-256-GCM Envelope Storage, Gmail Security Architecture and Threat Model, Gmail Threat Model (+1 more)

### Community 136 - "Knowledge Deduplication"
Cohesion: 0.18
Nodes (11): RowQualityErrorCode, RowQualityIssueDTO, RowQualityService, VALID / WARNING / INVALID Row States, Category-Aware Deduplication Architecture, Category-Specific Identity Key, CategoryIdentityResolver, Compatible vs Conflicting Duplicates (+3 more)

### Community 137 - "Phase 10 0 Event Contract"
Cohesion: 0.23
Nodes (10): Account Sync Lock gmail:sync:{account_id}, Coalescing High-Watermark (_LUA_ATOMIC_MAX), Failure, Retry & DLQ Contract, Phase 10.0 Event Contract Specification, Email Persistence Idempotency (ON CONFLICT DO NOTHING), provider_events record, Three-Tier Idempotency, Mailbox Coalescing Efficiency Benchmark (99%) (+2 more)

### Community 138 - "Phase 10 0 Ingestion Audit"
Cohesion: 0.20
Nodes (12): Redis Stream proxipilot:stream:email_events, Google OIDC JWT Verification, outbox_events (Transactional Outbox), sync_cursors State Machine & Cursor Invariant, Ambiguous Account Lookup Gap, Cursor Safety on Failure Gap, Phase 10.0 Ingestion Architecture Audit, GoogleTokenVerifier (+4 more)

### Community 143 - "Emailingeststack"
Cohesion: 0.42
Nodes (6): ActionConsoleCard(), EmailIngestStack(), INGEST_ITEMS, IngestItem, IntelligenceConstellation(), IntelligenceVisualStage()

### Community 144 - "Adr 021 Frontend Auth Backend Contract"
Cohesion: 0.22
Nodes (3): ADR-015: Business Profile Ownership and Boundary, ADR-016: Workspace Preference Ownership, ADR-021: Frontend-Backend Auth & Onboarding Contract

### Community 145 - "Ai Contracts"
Cohesion: 0.24
Nodes (10): AI Contracts (Backend V1), EmailUnderstandingResult, EvidenceAttribution, HumanReviewTrigger, RequirementPlan, ResponseDraft, ResponseValidationResult, RequirementPlan (continuation fields) (+2 more)

### Community 146 - "Ai Development Rules 2"
Cohesion: 0.24
Nodes (8): AI Development Rules, event_bus.publish, event_bus.send_to_dlq, QdrantManager.build_tenant_filter, RedisManager.build_tenant_key, TenantAwareMixin, ThreadPresentedEntity, outbound_messages table

### Community 147 - "Integrations Ui"
Cohesion: 0.18
Nodes (11): Conversation Entity, Inbox Architecture, Inbox Server Client Separation, Multi-Mailbox Aggregation, AI Summary Card, ConnectedIntegrationAccount, ComingSoonGrid, ConnectedAccountsSection (+3 more)

### Community 148 - "Knowledge Crud Api"
Cohesion: 0.18
Nodes (8): Knowledge Base CRUD API Reference, Knowledge CRUD REST Endpoints, Soft-Archive Delete, AuditService Knowledge Audit Contract, Knowledge Lifecycle & State Machine (Phase 7.0), Knowledge RBAC Actor Permissions, Point-in-Time Temporal Resolution, Requirement-Coverage Validation Gate

### Community 149 - "Knowledge File Storage"
Cohesion: 0.18
Nodes (9): FileUploadResponseDTO, Magic Bytes Signature Validation, Maintenance Cleanup Endpoint, Secure File Upload & Tenant-Safe Storage (Phase 8.1), secure_filename Sanitization, Tenant-Safe Checksum Duplicate Detection, Tenant-Scoped Storage Key Hierarchy, Upload Endpoint /knowledge/imports/upload (+1 more)

### Community 150 - "Knowledge Import Architecture"
Cohesion: 0.25
Nodes (9): Cooperative Cancellation Checkpoints, ImportJob, ImportJobStatus State Machine, Knowledge Import Architecture & Job Lifecycle (Phase 8.0), knowledge_import_events Redis Stream, KnowledgeImportWorker, recover_stuck_jobs Heartbeat Recovery, VALID_JOB_TRANSITIONS (+1 more)

### Community 152 - "Knowledge Retention"
Cohesion: 0.25
Nodes (3): KnowledgeRetentionService, RetentionEligibilityReport, RetentionPolicyConfig

### Community 153 - "Embedding Architecture"
Cohesion: 0.27
Nodes (11): Cohere Embed v4, Embedding Idempotency Cache, EmbeddingProvider Protocol, KnowledgeEmbeddingWorker, L2 Normalization Policy, Local Deterministic Embedding Fallback, Production Embedding Architecture (Phase 10 Foundation), Semaphore Bounded Batch Embedding (+3 more)

### Community 154 - "Enterprise Multi Category Knowledge Inge"
Cohesion: 0.24
Nodes (11): CandidateRole Category Mapping, ColumnMappingService, Enterprise Multi-Category Knowledge Ingestion and RAG Optimization Report, Mapping Compatibility Casing Normalization, Media Auto-Ignore with Essential URL Protection, Multi-Category Structured Retrieval Branch, MultiIntentDecomposer, Per-Requirement EvidenceGrouper (+3 more)

### Community 155 - "Knowledge Temporal Lifecycle"
Cohesion: 0.22
Nodes (10): knowledge_versions Table, Canonical Active-Version Filter Rule, Canonical Temporal Read Contract and Knowledge Lifecycle Retention, CanonicalKnowledgeReader, Knowledge Audit Taxonomy, KnowledgeRetentionService, Identity-Snapshot Separation, Knowledge Versioning Architecture (Phases 9.0-9.3) (+2 more)

### Community 156 - "Client Tenant Architecture"
Cohesion: 0.29
Nodes (8): ADR-005: Multi-Tenancy, get_current_tenant_id, JWT_SECRET_KEY Signed Access Token, Client Multi-Tenant Architecture, Query Key Factory, Tenant Cache Isolation, TenantProvider.switchOrganization, X-Organization-Id Context Selector Header

### Community 157 - "Backend Setup"
Cohesion: 0.20
Nodes (8): AiWorkerSettings, Alembic Migrations, ApiSettings, AutomationWorkerSettings, Backend Setup & Developer Guide, EmailWorkerSettings, Health / Ready / Metrics Probes, Unified Worker CLI Runner

### Community 158 - "Animation System"
Cohesion: 0.27
Nodes (7): FadeIn, FadeUp, ScaleIn, Scroll Animation System, Stagger, useInView IntersectionObserver Hook, useReducedMotion

### Community 160 - "Ai Architecture 2"
Cohesion: 0.29
Nodes (7): AI & LLM Engine Architecture, Dynamic Model Routing, Hybrid Retrieval (Qdrant + Postgres), Modular AI Processing Pipeline, Cost Optimization & Unit Economics, Fast-Path Economics, Thread Summarization & Context Pruning

### Community 161 - "Gmail Integration"
Cohesion: 0.22
Nodes (8): Gmail Account Lifecycle States, Gmail Integration Guide, Gmail OAuth Scopes, Multiple Gmail Account Support, Server-Side OAuth Flow, Independent Account Lifecycle, Integrations Architecture, Integrations OAuth Flow

### Community 162 - "Knowledge Category Schemas"
Cohesion: 0.20
Nodes (10): brand_communication Schema, company_info Schema, contacts Schema, Knowledge Category Schemas, locations Schema, offers_promotions Schema, operations Schema, policies Schema (+2 more)

### Community 163 - "Performance 2"
Cohesion: 0.20
Nodes (8): Connection Pooling Architecture, DatabaseManager, Performance & Concurrency Architecture, HttpClientManager, Latency Budgets & Targets, Layered Caching Hierarchy (L1/L2/L3), LruTtlCache, RedisManager

### Community 164 - "Similarity"
Cohesion: 0.27
Nodes (4): bounded_levenshtein_ratio(), compute_candidate_similarity(), token_jaccard_similarity(), tokenize_identifier()

### Community 167 - "Knowledge Dataset Profiling"
Cohesion: 0.22
Nodes (7): Bounded-Memory Dataset Profiling (Phase 8.2), BoundedCardinalityEstimator, ColumnAccumulator, ColumnProfileDTO, Enum Candidate Detection, HyperLogLog, TypeInferenceEngine

### Community 168 - "Knowledge Retrieval Contract"
Cohesion: 0.25
Nodes (6): idx_knowledge_versions_canonical_gin, knowledge_versions.canonical_data JSONB, AuthoritativeEvidenceObject, Eight-Stage Retrieval Pipeline, HybridRetrievalService, Phase 10 Hybrid Retrieval & Fact Verification Contract

### Community 169 - "Knowledge Qdrant Reconciliation"
Cohesion: 0.28
Nodes (7): knowledge_semantic_chunks, proxipilot_knowledge Qdrant Collection, Qdrant & PostgreSQL Semantic Chunk Reconciliation Report, test_qdrant_live_collection_reconciliation, content_text Retention, Knowledge Storage Table Disposition Analysis, Table Disposition Matrix

### Community 170 - "Phase 10 0 Load Test Report"
Cohesion: 0.28
Nodes (8): Fleet Scalability for 10k Burst (Little's Law), Background Sweeper Relay (FOR UPDATE SKIP LOCKED), 10k In-Memory Ingress & Dedup Benchmark, outbox_service.dispatch_fast_path, Phase 10.0 Load Test & Ingress Benchmark Report, Failure Recovery & Chaos Verification, Fleet Ingress Sizing & Capacity Model, Queue & Worker Drain Dynamics

### Community 171 - "Health"
Cohesion: 0.28
Nodes (3): liveness_probe(), metrics_endpoint(), readiness_probe()

### Community 172 - "Pagination"
Cohesion: 0.28
Nodes (3): CursorPaginatedResponse, CursorPaginationParams, ReverseCursorParams

### Community 174 - "Docker Compose 2"
Cohesion: 0.22
Nodes (9): POSTGRES_DB, POSTGRES_PASSWORD, POSTGRES_USER, environment, image, ports, restart, volumes (+1 more)

### Community 175 - "Enterprise Knowledge Ingestion Api Cost "
Cohesion: 0.28
Nodes (7): Brand-Category Decoupling, Enterprise Knowledge Ingestion API Cost and Mapping Optimization Report, KnowledgeReconciliationService, KnowledgeSchemaProfile Persistence, Premature Import Job Completion Defect, Semantic Boilerplate Stripping, Six Commercial Price Tier Preservation

### Community 176 - "Readme"
Cohesion: 0.25
Nodes (6): Next.js Agent Rules, Client CLAUDE.md, Client README (create-next-app), Geist Font via next/font, Next.js, Vercel Deployment

### Community 177 - "Package 2"
Cohesion: 0.25
Nodes (8): scripts, build, dev, format, format:check, lint, start, typecheck

### Community 178 - "Conversationdetailpane"
Cohesion: 0.43
Nodes (7): ConversationDetailPane(), ConversationDetailPaneProps, EmptyDetailPane(), getAvatarStyle(), getSubjectTopic(), ToolbarBtn(), Message

### Community 179 - "Orgpillarsbar"
Cohesion: 0.57
Nodes (4): OrganizationVisualStage(), OrgHierarchyCanvas(), ORG_PILLARS, OrgPillarsBar()

### Community 180 - "Animation System 2"
Cohesion: 0.39
Nodes (7): Scroll Animation System, FadeIn, FadeUp, ScaleIn, Stagger, useInView, useReducedMotion

### Community 181 - "Gmail Operations"
Cohesion: 0.25
Nodes (7): EmailWorker, Gmail Environment Configuration, Gmail Health Endpoint, Gmail Subsystem Operations Runbook, GmailRecoveryService.reconcile_all_accounts, Manual Mailbox Resync, Worker or Redis Crash Recovery Runbook

### Community 182 - "Knowledge Architecture"
Cohesion: 0.32
Nodes (6): Knowledge Architecture Phase 7.0, KnowledgeItem, KnowledgeSource, KnowledgeVersion, Source Authority Hierarchy, products_services Schema

### Community 183 - "Knowledge Parser Architecture"
Cohesion: 0.25
Nodes (8): CsvStreamParser, Deterministic Header Detection, Parser Resource Guardrails, ParserErrorType, sanitize_cell_value, Streaming Dataset Parser Architecture (Phase 8.2), XlsStreamParser, XlsxStreamParser

### Community 184 - "Knowledge Sources Lineage"
Cohesion: 0.25
Nodes (7): Qdrant Point Payload Contract, Knowledge Sources API Routes, Knowledge Sources, Lineage & Authority (Phase 7.4), KnowledgeSourceStatus Lifecycle, Phase 10 Lineage Grounding Payload, sanitize_audit_metadata, Source vs Version Temporal Validity

### Community 185 - "Phase 3 Gmail Integration"
Cohesion: 0.25
Nodes (6): connected_integration_accounts, Phase 3: Connected Gmail Accounts, EmailWorker, Min-Heap Priority Scheduling, Server-Side OAuth 2.0 with AES-256-GCM Token Encryption, sync_cursors

### Community 187 - "Docker Compose 3"
Cohesion: 0.36
Nodes (8): depends_on, depends_on, depends_on, postgres, redis, depends_on, condition, condition

### Community 188 - "Performance 3"
Cohesion: 0.25
Nodes (6): Async Non-Blocking Foundation, Connection Pooling Architecture, Latency Budgets, Layered Caching Hierarchy, Performance and Concurrency Architecture, Versioned Knowledge Cache Invalidation

### Community 189 - "Knowledge Semantic Projection"
Cohesion: 0.36
Nodes (8): Nine Knowledge Categories Taxonomy, AI-Ready Semantic Projection Architecture (Phase 8.6), Category-Specific Projector Templates, Deterministic Projection Invariant, knowledge_semantic_chunks Table, knowledge.semantic_projection.ready Event, KnowledgeProjectionService, Semantic Chunker

### Community 190 - "Database Architecture"
Cohesion: 0.29
Nodes (5): ADR-002 PostgreSQL + SQLAlchemy 2.0 Async, Composite Tenant Indexes, Partitioning Roadmap, Relational Database Architecture, SQLAlchemy 2.0 with asyncpg

### Community 191 - "Controlvisualstage"
Cohesion: 0.71
Nodes (3): ControlVisualStage(), DualPathDecisionCanvas(), IncomingTriggerCard()

### Community 192 - "Pricingplancards"
Cohesion: 0.52
Nodes (4): PlanItem, PLANS, PricingPlanCards(), PricingVisualStage()

### Community 194 - "Dsa Algorithms"
Cohesion: 0.29
Nodes (7): Three-Layer Duplicate Response Prevention, Three-Boundary Idempotency Enforcement, Algorithms & Data Structures Toolkit, BloomFilter, LruTtlCache, PriorityQueue, TokenBucket

### Community 196 - "Knowledge Multi Tenant Schema"
Cohesion: 0.38
Nodes (5): Anti-Cross-Tenant-Confusion Guarantee, build_tenant_cache_key, Cross-Tenant Foreign Key Protection, Multi-Tenant Knowledge Isolation Model, Dual Search Planner

### Community 197 - "Landing Page"
Cohesion: 0.38
Nodes (5): Animation Primitives (FadeIn/FadeUp/ScaleIn/Stagger), Public Landing Page Architecture, Layout & Spacing System, Reference Image Attachment Workflow, VisualStage component

### Community 198 - "Security Testing"
Cohesion: 0.43
Nodes (7): QdrantManager.build_tenant_filter, Tenant Isolation & IDOR Security Testing, Dual Tenant Isolation Test Architecture, IDOR Immunity, TenantScopingError, test_tenant_security.py suite, assert_qdrant_filter_has_tenant

### Community 199 - "Docker Compose 4"
Cohesion: 0.29
Nodes (7): command, env_file, environment, ports, restart, volumes, api

### Community 200 - "Section"
Cohesion: 0.53
Nodes (4): SectionProps, spacingMap, SectionBackground(), SectionBackgroundProps

### Community 202 - "Auth Security Tests"
Cohesion: 0.60
Nodes (6): Auth & Session Security Tests, Multi-Device Session Independence, OTP Attempt Lockout, OTP Resend Cooldown, Single-Use OTP with Redis TTL, test_auth_security.py Suite

### Community 203 - "Knowledge Flexible Attributes"
Cohesion: 0.33
Nodes (5): Canonical Category Registry, Flexible & Custom Attribute Architecture (Phase 7.1), KnowledgeAttributeDefinition, Validation Pre-Flight Endpoint, ColumnMappingIndex

### Community 204 - "Observability"
Cohesion: 0.40
Nodes (4): Observability Architecture, Prometheus /metrics, Structured Logging (structlog), GAP-4 Request ID Not Bound to Structlog

### Community 206 - "Docker Compose 5"
Cohesion: 0.53
Nodes (6): build, build, build, context, dockerfile, build

### Community 207 - "Docker Compose 6"
Cohesion: 0.33
Nodes (6): command, env_file, environment, restart, volumes, automation-worker

### Community 208 - "Docker Compose 7"
Cohesion: 0.33
Nodes (6): command, env_file, environment, restart, volumes, email-worker

### Community 209 - "Docker Compose 8"
Cohesion: 0.53
Nodes (6): interval, retries, test, timeout, healthcheck, healthcheck

### Community 210 - "Docker Compose 9"
Cohesion: 0.33
Nodes (6): command, image, ports, restart, volumes, redis

### Community 213 - "Proxy"
Cohesion: 0.40
Nodes (3): config, middleware, PROTECTED_PREFIXES

### Community 214 - "Adr 002 Database"
Cohesion: 0.40
Nodes (4): ADR-002: PostgreSQL + SQLAlchemy 2.0 Async, Neon Connection Pooling Constraints, PostgreSQL (Neon) + SQLAlchemy 2.0 + asyncpg, ADR-006: PostgreSQL as Source of Truth

### Community 215 - "Client Auth Architecture"
Cohesion: 0.50
Nodes (4): Client Authentication Architecture, ApiClient, AppError, useAuth

### Community 216 - "Database Architecture 2"
Cohesion: 0.40
Nodes (5): Relational Database Architecture, Access-Pattern Composite Indexes, Keyset Cursor Pagination, Monthly Range Partitioning Roadmap, SQLAlchemy 2.0 Async with asyncpg

### Community 219 - "Docker Compose 10"
Cohesion: 0.40
Nodes (5): image, ports, restart, volumes, qdrant

## Ambiguous Edges - Review These
- `Token-Derived Tenant Resolution` → `X-Organization-Id Context Selector Header`  [AMBIGUOUS]
  docs/CLIENT-TENANT-ARCHITECTURE.md · relation: conceptually_related_to
- `Canonical Core + Typed Relational Attributes` → `EAV Decommissioning (Migration d0e1f2a3b4c5)`  [AMBIGUOUS]
  docs/KNOWLEDGE-FLEXIBLE-ATTRIBUTES.md · relation: conceptually_related_to
- `V1 Role-Permission Matrix` → `5-Role RBAC with can(role, action)`  [AMBIGUOUS]
  docs/SECURITY.md · relation: conceptually_related_to
- `Authoritative Tenant Resolution & IDOR Prevention` → `Authoritative Token-Derived Tenant Resolution`  [AMBIGUOUS]
  docs/SECURITY.md · relation: conceptually_related_to
- `Core Tenant Resolution Security Rule` → `Authoritative Token-Derived Tenant Resolution`  [AMBIGUOUS]
  docs/adr/ADR-005-multi-tenancy.md · relation: conceptually_related_to
- `BusinessProfile Entity` → `Onboarding State Endpoint`  [AMBIGUOUS]
  docs/adr/ADR-015-business-profile-ownership.md · relation: conceptually_related_to
- `audit_events Table` → `Partitioning Roadmap`  [AMBIGUOUS]
  server/docs/DATABASE-ARCHITECTURE.md · relation: conceptually_related_to

## Knowledge Gaps
- **296 isolated node(s):** `proxipilot-backend`, `Backend Pytest Suite`, `Client CLAUDE.md`, `Geist Font via next/font`, `Vercel Deployment` (+291 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 2286 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **39 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Walkthrough Phase 2.8-2.13 Onboarding & Multi-Tenant Scoping` connect `Onboarding Step Forms & Hooks` to `Tenant Scoping Utilities`, `Ai Development Rules`, `Registration Shell UI`, `Organizations & Onboarding Models`?**
  _High betweenness centrality (0.297) - this node is a cross-community bridge._
- **Are the 38 inferred relationships involving `KnowledgeItem` (e.g. with `EmbeddingPipelineService` and `CandidateNormalizer`) actually correct?**
  _`KnowledgeItem` has 38 INFERRED edges - model-reasoned connections that need verification._
- **What connects `proxipilot-backend`, `Backend Pytest Suite`, `Client CLAUDE.md` to the rest of the system?**
  _296 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Reply Planner & Drafts` be split into smaller, more focused modules?**
  _Cohesion score 0.03364149974319466 - nodes in this community are weakly interconnected._
- **Why does `react` connect `Scroll Animation Primitives` to `Frontend Knowledge Module`, `Landing Page Layout`, `Emailingeststack`, `Integrations UI`, `Dashboard Overview UI`, `Registration Auth Forms`, `Frontend Providers & Stores`, `Onboarding Step Forms & Hooks`, `Landing Problem Section`, `App Shell Navigation`, `Conversationdetailpane`, `Client Dependencies`, `Orgpillarsbar`, `Hero Pipeline Visual`, `Bento Grid UI & Utils`, `Controlvisualstage`, `Pricingplancards`, `Registration Shell UI`, `Frontend Logging & Analytics`, `Section`, `Analyticscockpitframe`, `Faqvisualstage`, `Producttabswitcher`, `Page`, `Conversationlistitem`, `Testimonialcarousel`, `Useinbox`?**
  _High betweenness centrality (0.157) - this node is a cross-community bridge._

### Low-confidence Hints
_AMBIGUOUS edges — the extractor was unsure. Verify before acting on these._

- **What is the exact relationship between `Token-Derived Tenant Resolution` and `X-Organization-Id Context Selector Header`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Canonical Core + Typed Relational Attributes` and `EAV Decommissioning (Migration d0e1f2a3b4c5)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._