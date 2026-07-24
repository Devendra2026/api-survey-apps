-- Survey.id generation changed from cuid() to uuid() in the Prisma schema.
-- Both are application-side defaults (TEXT primary key has no DB DEFAULT).
-- Existing cuid rows remain valid; new inserts receive UUID v4 from Prisma Client.
SELECT 1;
