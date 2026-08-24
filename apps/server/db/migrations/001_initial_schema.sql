-- ============================================
-- TeamSpace Initial Database Schema
-- Migration: 001_initial_schema
-- ============================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- ============================================
-- USERS
-- ============================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    email TEXT NOT NULL UNIQUE,

    display_name TEXT NOT NULL,

    avatar_url TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================
-- WORKSPACES
-- ============================================

CREATE TABLE workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name TEXT NOT NULL,

    slug TEXT NOT NULL UNIQUE,

    owner_id UUID NOT NULL REFERENCES users(id)
        ON DELETE RESTRICT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================
-- MEMBERSHIPS
-- ============================================

CREATE TABLE memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    workspace_id UUID NOT NULL
        REFERENCES workspaces(id)
        ON DELETE CASCADE,

    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    role TEXT NOT NULL DEFAULT 'MEMBER',

    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT memberships_role_check
        CHECK (role IN ('OWNER', 'ADMIN', 'MEMBER')),

    CONSTRAINT memberships_workspace_user_unique
        UNIQUE (workspace_id, user_id)
);


-- ============================================
-- CHANNELS
-- ============================================

CREATE TABLE channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    workspace_id UUID NOT NULL
        REFERENCES workspaces(id)
        ON DELETE CASCADE,

    name TEXT NOT NULL,

    slug TEXT NOT NULL,

    description TEXT,

    is_private BOOLEAN NOT NULL DEFAULT FALSE,

    created_by UUID NOT NULL
        REFERENCES users(id)
        ON DELETE RESTRICT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT channels_workspace_slug_unique
        UNIQUE (workspace_id, slug)
);


-- ============================================
-- MESSAGES
-- ============================================

CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    channel_id UUID NOT NULL
        REFERENCES channels(id)
        ON DELETE CASCADE,

    sender_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE RESTRICT,

    content TEXT NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX memberships_user_id_idx
    ON memberships(user_id);

CREATE INDEX memberships_workspace_id_idx
    ON memberships(workspace_id);

CREATE INDEX channels_workspace_id_idx
    ON channels(workspace_id);

CREATE INDEX messages_channel_id_created_at_idx
    ON messages(channel_id, created_at);

CREATE INDEX messages_sender_id_idx
    ON messages(sender_id);