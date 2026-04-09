-- Drop self-serve password reset. Forgotten passwords are now handled by
-- an admin resetting the user via POST /api/users/:id/reset-password.
DROP TABLE IF EXISTS "PasswordResetToken";
