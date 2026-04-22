-- Donation Management Module Schema
-- Run after schema.sql

-- Wards
CREATE TABLE IF NOT EXISTS wards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parish_id UUID NOT NULL REFERENCES parishes(id) ON DELETE CASCADE,
    ward_name VARCHAR(100) NOT NULL,
    ward_name_odia VARCHAR(100),
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Units / Sangha
CREATE TABLE IF NOT EXISTS units (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parish_id UUID NOT NULL REFERENCES parishes(id) ON DELETE CASCADE,
    ward_id UUID NOT NULL REFERENCES wards(id) ON DELETE CASCADE,
    unit_name VARCHAR(100) NOT NULL,
    unit_name_odia VARCHAR(100),
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Donation types (configurable per parish)
CREATE TABLE IF NOT EXISTS donation_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parish_id UUID NOT NULL REFERENCES parishes(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    name_odia VARCHAR(100),
    is_recurring BOOLEAN DEFAULT FALSE,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(parish_id, code)
);

-- Donation family info (1:1 extension of families)
CREATE TABLE IF NOT EXISTS donation_family_info (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    family_id UUID UNIQUE NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    parish_id UUID NOT NULL REFERENCES parishes(id) ON DELETE CASCADE,
    card_number VARCHAR(50),
    ward_id UUID REFERENCES wards(id) ON DELETE SET NULL,
    unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
    monthly_pledge NUMERIC(10,2) DEFAULT 0,
    phone VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Donations
CREATE TABLE IF NOT EXISTS donations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    parish_id UUID NOT NULL REFERENCES parishes(id) ON DELETE CASCADE,
    donation_type_id UUID NOT NULL REFERENCES donation_types(id),
    donation_date DATE NOT NULL,
    month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
    year INT NOT NULL CHECK (year BETWEEN 2000 AND 2100),
    amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    receipt_number VARCHAR(50),
    remarks TEXT,
    recorded_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Donation receipts
CREATE TABLE IF NOT EXISTS donation_receipts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    receipt_number VARCHAR(50) UNIQUE NOT NULL,
    donation_id UUID REFERENCES donations(id) ON DELETE SET NULL,
    family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    parish_id UUID NOT NULL REFERENCES parishes(id) ON DELETE CASCADE,
    amount NUMERIC(10,2) NOT NULL,
    amount_in_words_odia TEXT,
    amount_in_words_english TEXT,
    date_issued DATE NOT NULL,
    issued_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_wards_parish ON wards(parish_id);
CREATE INDEX IF NOT EXISTS idx_units_parish ON units(parish_id);
CREATE INDEX IF NOT EXISTS idx_units_ward ON units(ward_id);
CREATE INDEX IF NOT EXISTS idx_donation_types_parish ON donation_types(parish_id);
CREATE INDEX IF NOT EXISTS idx_donation_family_info_family ON donation_family_info(family_id);
CREATE INDEX IF NOT EXISTS idx_donation_family_info_parish ON donation_family_info(parish_id);
CREATE INDEX IF NOT EXISTS idx_donations_family ON donations(family_id);
CREATE INDEX IF NOT EXISTS idx_donations_parish ON donations(parish_id);
CREATE INDEX IF NOT EXISTS idx_donations_date ON donations(donation_date);
CREATE INDEX IF NOT EXISTS idx_donations_month_year ON donations(year, month);
CREATE INDEX IF NOT EXISTS idx_donations_type ON donations(donation_type_id);
CREATE INDEX IF NOT EXISTS idx_donation_receipts_family ON donation_receipts(family_id);
CREATE INDEX IF NOT EXISTS idx_donation_receipts_parish ON donation_receipts(parish_id);

-- Seed default donation types (runs per parish via application or manually)
-- These are inserted by the backend seed endpoint or admin setup
