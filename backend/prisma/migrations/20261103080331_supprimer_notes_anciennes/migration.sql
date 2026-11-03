/*
  Warnings:

  - You are about to drop the `NoteCompetence` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `NoteLecon` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "NoteCompetence" DROP CONSTRAINT "NoteCompetence_competenceId_fkey";

-- DropForeignKey
ALTER TABLE "NoteCompetence" DROP CONSTRAINT "NoteCompetence_enseignantId_fkey";

-- DropForeignKey
ALTER TABLE "NoteCompetence" DROP CONSTRAINT "NoteCompetence_inscriptionId_fkey";

-- DropForeignKey
ALTER TABLE "NoteLecon" DROP CONSTRAINT "NoteLecon_enseignantId_fkey";

-- DropForeignKey
ALTER TABLE "NoteLecon" DROP CONSTRAINT "NoteLecon_inscriptionId_fkey";

-- DropForeignKey
ALTER TABLE "NoteLecon" DROP CONSTRAINT "NoteLecon_leconId_fkey";

-- DropTable
DROP TABLE "NoteCompetence";

-- DropTable
DROP TABLE "NoteLecon";
