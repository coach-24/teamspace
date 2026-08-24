ALTER TABLE users
ADD COLUMN auth_user_id UUID;

CREATE UNIQUE INDEX users_auth_user_id_unique
ON users(auth_user_id)
WHERE auth_user_id IS NOT NULL;