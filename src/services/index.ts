/**
 * services/index.ts — public re-exports.
 */
export { MockAuditLog } from './mockAuditLog';
export { MockDirectory } from './mockDirectory';
export { MockIdP } from './mockIdP';
export type { IdPConditionalPolicy, PasswordResolver } from './mockIdP';
export { MockAppServer } from './mockAppServer';
export type { AppLoginResult } from './mockAppServer';
export { MockTicketQueue } from './mockTicketQueue';
export type { NewTicket } from './mockTicketQueue';
export { MockAccessReviews } from './mockAccessReviews';
export { MockIncidents } from './mockIncidents';
export { FaultService, faultRegistry } from './faultService';
export type { FaultContext, FaultMutator } from './faultService';
export { OllamaSupervisor } from './ollamaSupervisor';
export type { OllamaConfig, StepScore } from './ollamaSupervisor';
