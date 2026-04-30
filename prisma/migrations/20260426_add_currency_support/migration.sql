-- Add currency field to Company table
ALTER TABLE "Company" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'USD';

-- Add currency field to Project table
ALTER TABLE "Project" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'USD';
