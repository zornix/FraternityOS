-- FraternityOS local schema (mirrors Supabase production)
-- Loaded automatically by docker-entrypoint-initdb.d

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE chapters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    organization TEXT NOT NULL,
    school TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_id UUID UNIQUE,
    chapter_id UUID REFERENCES chapters(id) NOT NULL,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT UNIQUE,
    role TEXT CHECK (role IN ('officer', 'member')) DEFAULT 'member',
    status TEXT CHECK (status IN ('active', 'inactive', 'alumni')) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chapter_id UUID REFERENCES chapters(id) NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    date DATE NOT NULL,
    time TIME NOT NULL,
    location TEXT NOT NULL,
    required BOOLEAN DEFAULT false,
    fine_amount DECIMAL(10,2) DEFAULT 0,
    created_by UUID REFERENCES members(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES events(id) NOT NULL,
    member_id UUID REFERENCES members(id) NOT NULL,
    checked_in BOOLEAN DEFAULT false,
    checked_in_at TIMESTAMPTZ,
    method TEXT CHECK (method IN ('link', 'manual')) DEFAULT 'link',
    UNIQUE(event_id, member_id)
);

CREATE TABLE excuses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES events(id) NOT NULL,
    member_id UUID REFERENCES members(id) NOT NULL,
    reason TEXT NOT NULL,
    status TEXT CHECK (status IN ('pending', 'approved', 'denied')) DEFAULT 'pending',
    reviewed_by UUID REFERENCES members(id),
    reviewed_at TIMESTAMPTZ,
    submitted_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(event_id, member_id)
);

CREATE TABLE fines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES events(id),
    member_id UUID REFERENCES members(id) NOT NULL,
    chapter_id UUID REFERENCES chapters(id) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    reason TEXT NOT NULL,
    status TEXT CHECK (status IN ('unpaid', 'paid', 'waived')) DEFAULT 'unpaid',
    issued_at TIMESTAMPTZ DEFAULT now(),
    paid_at TIMESTAMPTZ,
    waived_by UUID REFERENCES members(id)
);

CREATE TABLE checkin_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES events(id) NOT NULL,
    short_code TEXT UNIQUE NOT NULL,
    created_by UUID REFERENCES members(id) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);
