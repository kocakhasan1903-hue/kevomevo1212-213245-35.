export type ChatRelationship = 0 | 1 | 2 | 3;
export const chatRelationship = (value?: number): ChatRelationship => value === 1 || value === 2 || value === 3 ? value : 0;
export const relationshipLabel = (value: ChatRelationship) => ({0:'',1:'Herz',2:'Lächeln',3:'Totenkopf'}[value]);
/** All three types have equal priority; recent activity/name resolves ties. */
export const compareRelationshipPriority = (a?: number, b?: number) => Number(chatRelationship(b) > 0) - Number(chatRelationship(a) > 0);
