import { z } from "zod";

const EntityIdSchema = z
  .string()
  .min(3)
  .regex(/^[a-z][a-z0-9-]*:[a-z0-9][a-z0-9-]*$/);

export const ExpertisePersonSchema = z.object({
  id: EntityIdSchema.refine((id) => id.startsWith("person:"), {
    message: "Person IDs must start with person:"
  }),
  name: z.string().min(2),
  alias: z.string().min(2),
  team: z.string().min(2),
  role: z.string().min(2),
  aliases: z.array(z.string().min(2)).default([]),
  profileUrl: z.string().url().optional()
});

export const ExpertiseResourceSchema = z.object({
  id: EntityIdSchema,
  type: z.enum(["package", "pipeline", "bindle", "service", "resource", "account"]),
  name: z.string().min(2),
  description: z.string().min(4),
  tags: z.array(z.string().min(2)).min(1),
  aliases: z.array(z.string().min(2)).default([])
});

export const ExpertiseRelationshipSchema = z.object({
  id: EntityIdSchema.refine((id) => id.startsWith("relationship:"), {
    message: "Relationship IDs must start with relationship:"
  }),
  personId: EntityIdSchema,
  resourceId: EntityIdSchema,
  relation: z.enum(["owns", "maintains", "contributes-to"]),
  lastActive: z.string().date(),
  observedAt: z.string().datetime()
});

export const ExpertisePeopleFileSchema = z.array(ExpertisePersonSchema).min(1);
export const ExpertiseResourcesFileSchema = z
  .array(ExpertiseResourceSchema)
  .min(1);
export const ExpertiseRelationshipsFileSchema = z.array(
  ExpertiseRelationshipSchema
).min(1);

export type ExpertisePerson = z.infer<typeof ExpertisePersonSchema>;
export type ExpertiseResource = z.infer<typeof ExpertiseResourceSchema>;
export type ExpertiseRelationship = z.infer<
  typeof ExpertiseRelationshipSchema
>;

export interface ExpertiseDataset {
  people: ExpertisePerson[];
  resources: ExpertiseResource[];
  relationships: ExpertiseRelationship[];
}
