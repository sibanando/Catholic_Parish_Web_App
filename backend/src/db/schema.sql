-- Catholic Parish Web App Database Schema

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Parishes
CREATE TABLE IF NOT EXISTS parishes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    address TEXT,
    diocese VARCHAR(255),
    contact_info JSONB DEFAULT '{}',
    logo_path TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Families (household model)
CREATE TABLE IF NOT EXISTS families (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parish_id UUID NOT NULL REFERENCES parishes(id) ON DELETE CASCADE,
    family_name VARCHAR(255) NOT NULL,
    address TEXT,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'transferred', 'deceased')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- People (individual parishioners)
CREATE TABLE IF NOT EXISTS people (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    primary_family_id UUID REFERENCES families(id) ON DELETE SET NULL,
    first_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100),
    last_name VARCHAR(100) NOT NULL,
    maiden_name VARCHAR(100),
    baptismal_name VARCHAR(100),
    father_name VARCHAR(200),
    mother_name VARCHAR(200),
    dob DATE,
    gender VARCHAR(20) CHECK (gender IN ('male', 'female', 'other')),
    email VARCHAR(255),
    phone VARCHAR(50),
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'deceased', 'transferred')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Family memberships (person → family with role)
CREATE TABLE IF NOT EXISTS family_memberships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    relationship VARCHAR(100) NOT NULL,
    UNIQUE(family_id, person_id)
);

-- Sacrament types (seven sacraments)
CREATE TABLE IF NOT EXISTS sacrament_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    sequence_order INT NOT NULL
);

-- Sacraments (individual records)
CREATE TABLE IF NOT EXISTS sacraments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    sacrament_type_id UUID NOT NULL REFERENCES sacrament_types(id),
    parish_id UUID NOT NULL REFERENCES parishes(id),
    date DATE,
    celebrant VARCHAR(255),
    celebrant_role VARCHAR(100),
    register_volume VARCHAR(50),
    register_page VARCHAR(50),
    place VARCHAR(255),
    notes TEXT,
    status VARCHAR(50) DEFAULT 'completed' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sponsors (godparents, witnesses)
CREATE TABLE IF NOT EXISTS sacrament_sponsors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sacrament_id UUID NOT NULL REFERENCES sacraments(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(100) NOT NULL
);

-- Marriage specifics
CREATE TABLE IF NOT EXISTS marriages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sacrament_id UUID UNIQUE NOT NULL REFERENCES sacraments(id) ON DELETE CASCADE,
    spouse1_person_id UUID REFERENCES people(id),
    spouse2_person_id UUID REFERENCES people(id),
    canonical_form VARCHAR(100),
    dispensation_flags JSONB DEFAULT '{}'
);

-- Holy Orders specifics
CREATE TABLE IF NOT EXISTS holy_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sacrament_id UUID UNIQUE NOT NULL REFERENCES sacraments(id) ON DELETE CASCADE,
    order_level VARCHAR(100),
    religious_institute VARCHAR(255)
);

-- Certificate templates (per sacrament type per parish)
CREATE TABLE IF NOT EXISTS certificate_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parish_id UUID NOT NULL REFERENCES parishes(id) ON DELETE CASCADE,
    sacrament_type_id UUID NOT NULL REFERENCES sacrament_types(id),
    name VARCHAR(255) NOT NULL,
    html_template TEXT NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Generated certificates
CREATE TABLE IF NOT EXISTS certificates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sacrament_id UUID NOT NULL REFERENCES sacraments(id) ON DELETE CASCADE,
    template_id UUID REFERENCES certificate_templates(id),
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    generated_by_user_id UUID,
    storage_path TEXT,
    hash_or_qr_token VARCHAR(255) UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Certificate requests (from parishioner portal)
CREATE TABLE IF NOT EXISTS certificate_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requested_by_person_id UUID REFERENCES people(id),
    sacrament_type_id UUID NOT NULL REFERENCES sacrament_types(id),
    person_id UUID NOT NULL REFERENCES people(id),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'fulfilled')),
    reason TEXT,
    fulfilled_certificate_id UUID REFERENCES certificates(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users (staff accounts)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parish_id UUID NOT NULL REFERENCES parishes(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    refresh_token_hash TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Roles
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL
);

-- User-Role junction
CREATE TABLE IF NOT EXISTS user_roles (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

-- Immutable audit log (no UPDATE/DELETE)
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID,
    action VARCHAR(100) NOT NULL,
    before_snapshot JSONB,
    after_snapshot JSONB,
    ip_address VARCHAR(50),
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Seed seven sacraments
INSERT INTO sacrament_types (code, name, sequence_order) VALUES
    ('BAPTISM',      'Baptism',                    1),
    ('EUCHARIST',    'Eucharist (First Holy Communion)', 2),
    ('PENANCE',      'Penance / Reconciliation',   3),
    ('CONFIRMATION', 'Confirmation',               4),
    ('MATRIMONY',    'Matrimony',                  5),
    ('HOLY_ORDERS',  'Holy Orders',                6),
    ('ANOINTING',    'Anointing of the Sick',      7)
ON CONFLICT (code) DO NOTHING;

-- Seed roles
INSERT INTO roles (name) VALUES
    ('parish_admin'),
    ('sacramental_clerk'),
    ('priest'),
    ('auditor'),
    ('parishioner')
ON CONFLICT (name) DO NOTHING;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_families_parish ON families(parish_id);
CREATE INDEX IF NOT EXISTS idx_families_status ON families(status);
CREATE INDEX IF NOT EXISTS idx_families_name ON families(family_name);
CREATE INDEX IF NOT EXISTS idx_people_family ON people(primary_family_id);
CREATE INDEX IF NOT EXISTS idx_people_name ON people(last_name, first_name);
CREATE INDEX IF NOT EXISTS idx_sacraments_person ON sacraments(person_id);
CREATE INDEX IF NOT EXISTS idx_sacraments_type ON sacraments(sacrament_type_id);
CREATE INDEX IF NOT EXISTS idx_sacraments_parish ON sacraments(parish_id);
CREATE INDEX IF NOT EXISTS idx_sacraments_date ON sacraments(date);
CREATE INDEX IF NOT EXISTS idx_sacraments_status ON sacraments(status);
CREATE INDEX IF NOT EXISTS idx_family_memberships_person ON family_memberships(person_id);
CREATE INDEX IF NOT EXISTS idx_family_memberships_family ON family_memberships(family_id);
CREATE INDEX IF NOT EXISTS idx_certificates_sacrament ON certificates(sacrament_id);
CREATE INDEX IF NOT EXISTS idx_certificates_token ON certificates(hash_or_qr_token);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_parish ON users(parish_id);
