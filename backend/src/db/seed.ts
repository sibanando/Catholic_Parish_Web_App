import bcrypt from 'bcryptjs';
import pool from './pool';

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create parish
    const parishRes = await client.query(`
      INSERT INTO parishes (name, address, diocese, contact_info)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT DO NOTHING
      RETURNING id
    `, [
      "St. Mary's Parish",
      "123 Church Street, Springfield, IL 62701",
      "Diocese of Springfield",
      JSON.stringify({ phone: '(217) 555-0100', email: 'office@stmarys.org' })
    ]);

    const parishId = parishRes.rows[0]?.id;
    if (!parishId) {
      console.log('Parish already seeded');
      await client.query('ROLLBACK');
      return;
    }

    // Get role IDs
    const rolesRes = await client.query('SELECT id, name FROM roles');
    const roles: Record<string, string> = {};
    rolesRes.rows.forEach(r => { roles[r.name] = r.id; });

    // Create users
    const adminHash = await bcrypt.hash('Admin@1234', 12);
    const clerkHash = await bcrypt.hash('Clerk@1234', 12);
    const priestHash = await bcrypt.hash('Priest@1234', 12);

    const adminRes = await client.query(`
      INSERT INTO users (parish_id, email, password_hash, first_name, last_name)
      VALUES ($1, $2, $3, $4, $5) RETURNING id
    `, [parishId, 'admin@stmarys.org', adminHash, 'Maria', 'Santos']);

    const clerkRes = await client.query(`
      INSERT INTO users (parish_id, email, password_hash, first_name, last_name)
      VALUES ($1, $2, $3, $4, $5) RETURNING id
    `, [parishId, 'clerk@stmarys.org', clerkHash, 'John', 'Rivera']);

    const priestRes = await client.query(`
      INSERT INTO users (parish_id, email, password_hash, first_name, last_name)
      VALUES ($1, $2, $3, $4, $5) RETURNING id
    `, [parishId, 'priest@stmarys.org', priestHash, 'Fr. Thomas', 'Aquino']);

    // Assign roles
    await client.query('INSERT INTO user_roles VALUES ($1, $2)', [adminRes.rows[0].id, roles['parish_admin']]);
    await client.query('INSERT INTO user_roles VALUES ($1, $2)', [clerkRes.rows[0].id, roles['sacramental_clerk']]);
    await client.query('INSERT INTO user_roles VALUES ($1, $2)', [priestRes.rows[0].id, roles['priest']]);

    // Create families
    const familyNames = ['De la Cruz', 'Gonzalez', 'Reyes'];
    const familyIds: string[] = [];
    for (const name of familyNames) {
      const res = await client.query(`
        INSERT INTO families (parish_id, family_name, address, status)
        VALUES ($1, $2, $3, 'active') RETURNING id
      `, [parishId, name, '456 Maple Ave, Springfield, IL 62701']);
      familyIds.push(res.rows[0].id);
    }

    // Create people and memberships
    type SeedPerson = { firstName: string; lastName: string; dob: string; gender: string; relationship: string };
    const membersData: SeedPerson[][] = [
      [
        { firstName: 'Carlos', lastName: 'De la Cruz', dob: '1975-03-15', gender: 'male', relationship: 'head' },
        { firstName: 'Elena', lastName: 'De la Cruz', dob: '1978-07-22', gender: 'female', relationship: 'spouse' },
        { firstName: 'Miguel', lastName: 'De la Cruz', dob: '2005-09-10', gender: 'male', relationship: 'child' },
      ],
      [
        { firstName: 'Roberto', lastName: 'Gonzalez', dob: '1968-11-05', gender: 'male', relationship: 'head' },
        { firstName: 'Ana', lastName: 'Gonzalez', dob: '1970-04-18', gender: 'female', relationship: 'spouse' },
        { firstName: 'Sofia', lastName: 'Gonzalez', dob: '1998-01-30', gender: 'female', relationship: 'child' },
        { firstName: 'Luis', lastName: 'Gonzalez', dob: '2002-06-14', gender: 'male', relationship: 'child' },
      ],
      [
        { firstName: 'Jose', lastName: 'Reyes', dob: '1980-08-25', gender: 'male', relationship: 'head' },
        { firstName: 'Carmen', lastName: 'Reyes', dob: '1983-12-03', gender: 'female', relationship: 'spouse' },
        { firstName: 'Isabella', lastName: 'Reyes', dob: '2010-02-19', gender: 'female', relationship: 'child' },
      ],
    ];

    const personIds: string[][] = [];
    for (let fi = 0; fi < familyIds.length; fi++) {
      const ids: string[] = [];
      for (const m of membersData[fi]) {
        const pr = await client.query(`
          INSERT INTO people (primary_family_id, first_name, last_name, dob, gender, status)
          VALUES ($1, $2, $3, $4, $5, 'active') RETURNING id
        `, [familyIds[fi], m.firstName, m.lastName, m.dob, m.gender]);
        ids.push(pr.rows[0].id);
        await client.query(`
          INSERT INTO family_memberships (family_id, person_id, relationship)
          VALUES ($1, $2, $3)
        `, [familyIds[fi], pr.rows[0].id, m.relationship]);
      }
      personIds.push(ids);
    }

    // Get sacrament type IDs
    const stRes = await client.query('SELECT id, code FROM sacrament_types ORDER BY sequence_order');
    const st: Record<string, string> = {};
    stRes.rows.forEach(r => { st[r.code] = r.id; });

    // Record sacraments
    const celebrant = 'Fr. Thomas Aquino';
    const sacramentRecords = [
      { personId: personIds[0][0], code: 'BAPTISM', date: '1975-04-06', place: "St. Joseph's Church" },
      { personId: personIds[0][0], code: 'EUCHARIST', date: '1985-05-15', place: "St. Mary's Parish" },
      { personId: personIds[0][0], code: 'CONFIRMATION', date: '1990-10-20', place: "St. Mary's Parish" },
      { personId: personIds[0][0], code: 'MATRIMONY', date: '2003-06-21', place: "St. Mary's Parish" },
      { personId: personIds[0][2], code: 'BAPTISM', date: '2005-10-01', place: "St. Mary's Parish" },
      { personId: personIds[1][2], code: 'BAPTISM', date: '1998-03-01', place: "St. Mary's Parish" },
      { personId: personIds[1][2], code: 'EUCHARIST', date: '2008-05-10', place: "St. Mary's Parish" },
      { personId: personIds[2][1], code: 'ANOINTING', date: '2022-09-15', place: "Springfield General Hospital" },
      { personId: personIds[1][0], code: 'HOLY_ORDERS', date: '1990-06-29', place: 'Cathedral of the Immaculate Conception' },
      { personId: personIds[0][1], code: 'PENANCE', date: '1988-03-15', place: "St. Mary's Parish" },
    ];

    for (const sr of sacramentRecords) {
      await client.query(`
        INSERT INTO sacraments (person_id, sacrament_type_id, parish_id, date, celebrant, celebrant_role, status)
        VALUES ($1, $2, $3, $4, $5, 'priest', 'completed')
      `, [sr.personId, st[sr.code], parishId, sr.date, celebrant]);
    }

    // Certificate templates
    const baptismTemplate = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Georgia, serif; text-align: center; padding: 40px; }
    .header { border-bottom: 3px double #8B6914; padding-bottom: 20px; }
    h1 { color: #1a3a5c; font-size: 2em; }
    h2 { color: #8B6914; }
    .content { margin: 30px auto; max-width: 600px; }
    .field { margin: 10px 0; font-size: 1.1em; }
    .footer { margin-top: 40px; border-top: 2px solid #8B6914; padding-top: 20px; }
    .signature-block { display: flex; justify-content: space-around; margin-top: 30px; }
    .signature-line { border-top: 1px solid #333; width: 200px; text-align: center; padding-top: 5px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>{{parish_name}}</h1>
    <h2>Certificate of Baptism</h2>
    <p>{{parish_address}}</p>
  </div>
  <div class="content">
    <p>This is to certify that</p>
    <h2>{{person_name}}</h2>
    <p>child of <strong>{{parents}}</strong></p>
    <p>was solemnly baptized according to the rite of the Catholic Church</p>
    <p>on <strong>{{sacrament_date}}</strong></p>
    <p>at <strong>{{place}}</strong></p>
    <p>by <strong>{{celebrant}}</strong></p>
    <p>Sponsors: <strong>{{sponsors}}</strong></p>
    <p>Register: Volume <strong>{{register_volume}}</strong>, Page <strong>{{register_page}}</strong></p>
  </div>
  <div class="footer">
    <div class="signature-block">
      <div class="signature-line">Parish Priest</div>
      <div class="signature-line">Parish Secretary</div>
    </div>
    <p style="margin-top: 20px; font-size: 0.8em;">
      Verify at: {{verification_url}}<br/>
      Token: {{qr_token}}
    </p>
  </div>
</body>
</html>`;

    await client.query(`
      INSERT INTO certificate_templates (parish_id, sacrament_type_id, name, html_template, is_default)
      VALUES ($1, $2, 'Standard Baptism Certificate', $3, true)
    `, [parishId, st['BAPTISM'], baptismTemplate]);

    await client.query(`
      INSERT INTO certificate_templates (parish_id, sacrament_type_id, name, html_template, is_default)
      VALUES ($1, $2, 'Standard Confirmation Certificate', $3, true)
    `, [parishId, st['CONFIRMATION'], baptismTemplate.replace('Baptism', 'Confirmation')]);

    await client.query('COMMIT');
    console.log('Seed completed successfully!');
    console.log('Users created:');
    console.log('  Admin:  admin@stmarys.org / Admin@1234');
    console.log('  Clerk:  clerk@stmarys.org / Clerk@1234');
    console.log('  Priest: priest@stmarys.org / Priest@1234');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(console.error);
