import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { certificatesApi } from '../api/client';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface CertData {
  personName: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  baptismalName?: string;
  dob?: string;
  fatherName: string;
  motherName: string;
  sacramentCode: string;
  sacramentName: string;
  date?: string;
  place?: string;
  celebrant?: string;
  celebrantRole?: string;
  registerVolume?: string;
  registerPage?: string;
  notes?: string;
  sponsors: Array<{ name: string; role: string }>;
  crossRef: Record<string, { date?: string; place?: string }>;
  marriageData?: {
    spouse1_first?: string; spouse1_last?: string;
    spouse2_first?: string; spouse2_last?: string;
    spouse2_father_name?: string; spouse2_mother_name?: string;
    spouse2_address?: string;
  };
  holyOrdersData?: {
    order_level?: string; religious_institute?: string;
  };
  parishName: string;
  parishAddress: string;
  diocese: string;
  logoPath?: string;
  qrDataUrl?: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
const fmtDate = (d?: string) => {
  if (!d) return '_______________';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};

const CERT_TITLES: Record<string, string> = {
  BAPTISM: 'Certificate of Baptism',
  EUCHARIST: 'Certificate of First Holy Communion',
  CONFIRMATION: 'Certificate of Confirmation',
  PENANCE: 'Certificate of First Confession',
  MATRIMONY: 'Certificate of Marriage',
  HOLY_ORDERS: 'Certificate of Holy Orders',
  ANOINTING: 'Certificate of Anointing of the Sick',
};

/* ------------------------------------------------------------------ */
/*  Corner ornament SVG                                                */
/* ------------------------------------------------------------------ */
function CornerSvg() {
  return (
    <svg viewBox="0 0 80 80" style={{ width: '100%', height: '100%' }}>
      <path d="M0 0Q35 3 60 0Q55 25 65 55Q60 65 80 80Q50 70 25 65Q8 58 0 80Q5 50 0 0Z" fill="none" stroke="#C5973E" strokeWidth="1.3" opacity=".55" />
      <path d="M4 4Q22 7 40 4" fill="none" stroke="#C5973E" strokeWidth=".7" opacity=".4" />
      <path d="M4 4Q7 22 4 40" fill="none" stroke="#C5973E" strokeWidth=".7" opacity=".4" />
      <circle cx="7" cy="7" r="2.5" fill="none" stroke="#C5973E" strokeWidth=".8" opacity=".5" />
      <circle cx="7" cy="7" r="1" fill="#C5973E" opacity=".45" />
      <path d="M12 0Q14 8 20 12" fill="none" stroke="#C5973E" strokeWidth=".5" opacity=".3" />
      <path d="M0 12Q8 14 12 20" fill="none" stroke="#C5973E" strokeWidth=".5" opacity=".3" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  QR icon SVG                                                        */
/* ------------------------------------------------------------------ */
function QrIcon() {
  return (
    <svg viewBox="0 0 24 24" style={{ width: 38, height: 38, opacity: 0.3 }}>
      <rect x="2" y="2" width="8" height="8" rx="1" fill="none" stroke="#6B1D2A" strokeWidth="1.4" />
      <rect x="4" y="4" width="4" height="4" fill="#6B1D2A" />
      <rect x="14" y="2" width="8" height="8" rx="1" fill="none" stroke="#6B1D2A" strokeWidth="1.4" />
      <rect x="16" y="4" width="4" height="4" fill="#6B1D2A" />
      <rect x="2" y="14" width="8" height="8" rx="1" fill="none" stroke="#6B1D2A" strokeWidth="1.4" />
      <rect x="4" y="16" width="4" height="4" fill="#6B1D2A" />
      <rect x="14" y="14" width="2" height="2" fill="#6B1D2A" />
      <rect x="18" y="14" width="2" height="2" fill="#6B1D2A" />
      <rect x="14" y="18" width="2" height="2" fill="#6B1D2A" />
      <rect x="18" y="18" width="4" height="4" fill="#6B1D2A" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Per-sacrament body content                                         */
/* ------------------------------------------------------------------ */
function CertBody({ d }: { d: CertData }) {
  const baptismDate = fmtDate(d.crossRef?.BAPTISM?.date);
  const baptismPlace = d.crossRef?.BAPTISM?.place || '_______________';
  const confDate = fmtDate(d.crossRef?.CONFIRMATION?.date);
  const confPlace = d.crossRef?.CONFIRMATION?.place || '_______________';
  const allSponsors = (d.sponsors || []).map(s => s.name).join(', ') || '_______________';
  const godparents = (d.sponsors || [])
    .filter(s => ['godfather', 'godmother', 'godparent'].includes((s.role || '').toLowerCase()))
    .map(s => s.name).join(', ') || allSponsors;

  switch (d.sacramentCode) {
    case 'BAPTISM':
      return (
        <>
          <div className="c-loc">{d.parishAddress || d.place || ''}</div>
          <div className="c-bd">
            This is to certify that
            <span className="c-nm">{d.personName}</span>
            <span className="c-co">child of</span>
            <span className="c-pa">{d.fatherName || '_______________'} &amp; {d.motherName || '_______________'}</span>
            was solemnly baptized according to the rite of the Catholic Church
            <span className="c-dt">on <b>{fmtDate(d.date)}</b> <span className="c-lb">(Date)</span></span>
            <span className="c-dt">at <b>{d.place || '_______________'}</b> <span className="c-lb">(Place)</span></span>
            <span className="c-dt">by <b>{d.celebrant || '_______________'}</b> <span className="c-lb">(Minister)</span></span>
            <span className="c-dt">Sponsors: <b>{godparents}</b> <span className="c-lb">(Godparent)</span></span>
          </div>
          <div className="c-rg">Register: Volume {d.registerVolume || '___'}, Page {d.registerPage || '___'}</div>
        </>
      );
    case 'EUCHARIST':
      return (
        <>
          <div className="c-loc">{d.parishAddress || d.place || ''}</div>
          <div className="c-bd">
            This is to certify that
            <span className="c-nm">{d.personName}</span>
            <span className="c-co">child of</span>
            <span className="c-pa">{d.fatherName || '_______________'} &amp; {d.motherName || '_______________'}</span>
            baptized on <b>{baptismDate}</b> at <b>{baptismPlace}</b><br />
            received the Sacrament of First Holy Communion
            <span className="c-dt">on <b>{fmtDate(d.date)}</b> <span className="c-lb">(Date)</span></span>
            <span className="c-dt">at <b>{d.place || '_______________'}</b> <span className="c-lb">(Place)</span></span>
            <span className="c-dt">Celebrant: <b>{d.celebrant || '_______________'}</b></span>
          </div>
          <div className="c-rg">Register: Volume {d.registerVolume || '___'}, Page {d.registerPage || '___'}</div>
        </>
      );
    case 'CONFIRMATION':
      return (
        <>
          <div className="c-loc">{d.parishAddress || d.place || ''}</div>
          <div className="c-bd">
            This is to certify that
            <span className="c-nm">{d.personName}</span>
            Confirmation Name: <b>{d.baptismalName || '_______________'}</b><br />
            <span className="c-co">child of</span>
            <span className="c-pa">{d.fatherName || '_______________'} &amp; {d.motherName || '_______________'}</span>
            baptized on <b>{baptismDate}</b> at <b>{baptismPlace}</b><br />
            was confirmed in the Catholic Faith
            <span className="c-dt">on <b>{fmtDate(d.date)}</b> <span className="c-lb">(Date)</span></span>
            <span className="c-dt">at <b>{d.place || '_______________'}</b> <span className="c-lb">(Place)</span></span>
            <span className="c-dt">by Bishop <b>{d.celebrant || '_______________'}</b></span>
            <span className="c-dt">Sponsor: <b>{allSponsors}</b></span>
          </div>
          <div className="c-rg">Register: Volume {d.registerVolume || '___'}, Page {d.registerPage || '___'}</div>
        </>
      );
    case 'PENANCE':
      return (
        <>
          <div className="c-loc">{d.parishAddress || d.place || ''}</div>
          <div className="c-bd">
            This is to certify that
            <span className="c-nm">{d.personName}</span>
            <span className="c-co">child of</span>
            <span className="c-pa">{d.fatherName || '_______________'} &amp; {d.motherName || '_______________'}</span>
            baptized on <b>{baptismDate}</b> at <b>{baptismPlace}</b><br />
            received the Sacrament of Reconciliation for the first time
            <span className="c-dt">on <b>{fmtDate(d.date)}</b> <span className="c-lb">(Date)</span></span>
            <span className="c-dt">at <b>{d.place || '_______________'}</b> <span className="c-lb">(Place)</span></span>
            <span className="c-dt">Confessor: <b>{d.celebrant || '_______________'}</b></span>
          </div>
          <div className="c-rg">Register: Volume {d.registerVolume || '___'}, Page {d.registerPage || '___'}</div>
        </>
      );
    case 'MATRIMONY': {
      const sp1 = d.marriageData
        ? `${d.marriageData.spouse1_first || ''} ${d.marriageData.spouse1_last || ''}`.trim()
        : d.personName;
      const sp2 = d.marriageData
        ? `${d.marriageData.spouse2_first || ''} ${d.marriageData.spouse2_last || ''}`.trim()
        : '';
      const witnesses = d.sponsors || [];
      return (
        <>
          <div className="c-bd" style={{ maxWidth: 510, marginBottom: 4 }}>
            This is to certify that the Sacrament of Holy Matrimony was celebrated between
          </div>
          <div className="c-shdr">Groom</div>
          <table className="c-ft">
            <tbody>
              <tr><td className="c-lc">Groom's Name</td><td className="c-vc">{sp1}</td></tr>
              <tr><td className="c-lc">Father's Name</td><td className="c-vc">{d.fatherName}</td></tr>
              <tr><td className="c-lc">Mother's Name</td><td className="c-vc">{d.motherName}</td></tr>
              <tr><td className="c-lc">Address / Parish</td><td className="c-vc">{d.parishAddress || d.place || ''}</td></tr>
            </tbody>
          </table>
          <div className="c-shdr">Bride</div>
          <table className="c-ft">
            <tbody>
              <tr><td className="c-lc">Bride's Name</td><td className="c-vc">{sp2}</td></tr>
              <tr><td className="c-lc">Father's Name</td><td className="c-vc">{d.marriageData?.spouse2_father_name || ''}</td></tr>
              <tr><td className="c-lc">Mother's Name</td><td className="c-vc">{d.marriageData?.spouse2_mother_name || ''}</td></tr>
              <tr><td className="c-lc">Address / Parish</td><td className="c-vc">{d.marriageData?.spouse2_address || ''}</td></tr>
            </tbody>
          </table>
          <div className="c-gr-s" style={{ margin: '8px auto' }}></div>
          <div className="c-bd" style={{ marginTop: 0 }}>
            <span className="c-dt">on <b>{fmtDate(d.date)}</b> <span className="c-lb">(Date)</span></span>
            <span className="c-dt">at <b>{d.place || '_______________'}</b> <span className="c-lb">(Place)</span></span>
            <span className="c-dt">Officiant: <b>{d.celebrant || '_______________'}</b></span>
            <span className="c-dt">
              Witness 1: <b>{witnesses[0]?.name || '_______________'}</b>
              &nbsp;&nbsp;
              Witness 2: <b>{witnesses[1]?.name || '_______________'}</b>
            </span>
          </div>
          <div className="c-rg">Register: Volume {d.registerVolume || '___'}, Page {d.registerPage || '___'}</div>
        </>
      );
    }
    case 'HOLY_ORDERS':
      return (
        <>
          <div className="c-bd">
            This is to certify that
            <span className="c-nm">{d.personName}</span>
            <span className="c-co">child of</span>
            <span className="c-pa">{d.fatherName || '_______________'} &amp; {d.motherName || '_______________'}</span>
            <span className="c-dt">born on <b>{fmtDate(d.dob)}</b></span>
            <span className="c-dt">baptized on <b>{baptismDate}</b> at <b>{baptismPlace}</b></span>
            <span className="c-dt">confirmed on <b>{confDate}</b> at <b>{confPlace}</b></span>
            <span className="c-dt">Seminary: <b>{d.holyOrdersData?.religious_institute || '_______________'}</b></span>
            was ordained to the Order of <b>{d.holyOrdersData?.order_level || '_______________'}</b>
            <span className="c-dt">on <b>{fmtDate(d.date)}</b> <span className="c-lb">(Date)</span></span>
            <span className="c-dt">at <b>{d.place || '_______________'}</b> <span className="c-lb">(Place)</span></span>
            <span className="c-dt">by Bishop <b>{d.celebrant || '_______________'}</b></span>
          </div>
          <div className="c-rg">Register: Volume {d.registerVolume || '___'}, Page {d.registerPage || '___'}</div>
        </>
      );
    case 'ANOINTING':
      return (
        <>
          <div className="c-loc">{d.parishAddress || d.place || ''}</div>
          <div className="c-bd">
            This is to certify that
            <span className="c-nm">{d.personName}</span>
            <span className="c-dt">of Parish <b>{d.parishName}</b></span>
            <span className="c-dt">Address: <b>{d.parishAddress || '_______________'}</b></span>
            received the Sacrament of the Anointing of the Sick
            <span className="c-dt">on <b>{fmtDate(d.date)}</b> <span className="c-lb">(Date)</span></span>
            <span className="c-dt">at <b>{d.place || '_______________'}</b> <span className="c-lb">(Place)</span></span>
            <span className="c-dt">by <b>{d.celebrant || '_______________'}</b> <span className="c-lb">(Priest)</span></span>
            <span className="c-dt">Witness: <b>{allSponsors}</b></span>
          </div>
          <div className="c-rg">Remarks: {d.notes || '_____________________________________________________'}</div>
        </>
      );
    default:
      return (
        <>
          <div className="c-bd">
            This is to certify that
            <span className="c-nm">{d.personName}</span>
            received the Sacrament of {d.sacramentName}
            <span className="c-dt">on <b>{fmtDate(d.date)}</b></span>
            <span className="c-dt">at <b>{d.place || '_______________'}</b></span>
            <span className="c-dt">by <b>{d.celebrant || '_______________'}</b></span>
          </div>
          <div className="c-rg">Register: Volume {d.registerVolume || '___'}, Page {d.registerPage || '___'}</div>
        </>
      );
  }
}

/* ------------------------------------------------------------------ */
/*  CSS                                                                */
/* ------------------------------------------------------------------ */
const CERT_CSS = `
.cert-root{position:fixed;inset:0;overflow-y:auto;z-index:9999;background:linear-gradient(160deg,#D8CEBF,#E6DED0,#D8CEBF);font-family:'Cormorant Garamond',serif;color:#3D2B1F;min-height:100vh;}
.cert-root *{margin:0;padding:0;box-sizing:border-box;}

/* Nav */
.cert-root .c-nav{position:fixed;top:0;left:0;right:0;z-index:100;background:linear-gradient(135deg,#4A0E1C,#6B1D2A);display:flex;align-items:center;gap:8px;padding:10px 18px;box-shadow:0 4px 20px rgba(74,14,28,0.4);}
.cert-root .c-nav .c-logo{font-family:'Cinzel Decorative',serif;color:#C5973E;font-size:12px;letter-spacing:2px;white-space:nowrap;margin-right:6px;}
.cert-root .c-nav button{background:transparent;border:1px solid rgba(197,151,62,0.3);color:#E8D5A3;font-family:'Cinzel',serif;font-size:10.5px;padding:5px 12px;border-radius:3px;cursor:pointer;transition:all .3s;white-space:nowrap;letter-spacing:1px;}
.cert-root .c-nav button:hover{background:#C5973E;color:#4A0E1C;border-color:#C5973E;font-weight:600;}
.cert-root .c-nav .c-pb{margin-left:auto;background:#C5973E;color:#4A0E1C;font-weight:600;border-color:#C5973E;}
.cert-root .c-nav .c-pb:hover{background:#E8D5A3;}

/* Page */
.cert-root .c-pg{width:210mm;min-height:297mm;margin:76px auto 36px;background:#FFFCF5;position:relative;overflow:hidden;box-shadow:0 10px 60px rgba(44,24,16,0.18);page-break-after:always;animation:certUp .65s cubic-bezier(.22,1,.36,1) both;}
@keyframes certUp{from{opacity:0;transform:translateY(36px)}to{opacity:1;transform:translateY(0)}}

/* Background texture */
.cert-root .c-bg{position:absolute;inset:0;pointer-events:none;z-index:0;background:radial-gradient(ellipse at 25% 15%,rgba(197,151,62,0.04) 0%,transparent 55%),radial-gradient(ellipse at 75% 85%,rgba(107,29,42,0.03) 0%,transparent 55%),url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none'%3E%3Cg fill='%23C5973E' fill-opacity='0.025'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");}

/* Watermark */
.cert-root .c-wm{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:300px;color:rgba(107,29,42,0.025);pointer-events:none;z-index:0;line-height:1;font-family:serif;}

/* Border */
.cert-root .c-bdr{position:absolute;inset:10mm;border:2.5px solid #C5973E;pointer-events:none;z-index:1;}
.cert-root .c-bdr::before{content:'';position:absolute;inset:3px;border:1px solid #E8D5A3;}
.cert-root .c-bdr::after{content:'';position:absolute;inset:7px;border:1px solid rgba(197,151,62,0.25);}

/* Corners */
.cert-root .c-cr{position:absolute;z-index:2;pointer-events:none;width:80px;height:80px;opacity:.6;}
.cert-root .c-cr svg{width:100%;height:100%;}
.cert-root .c-tl{top:8mm;left:8mm;}
.cert-root .c-tr{top:8mm;right:8mm;transform:scaleX(-1);}
.cert-root .c-bl{bottom:8mm;left:8mm;transform:scaleY(-1);}
.cert-root .c-br{bottom:8mm;right:8mm;transform:scale(-1,-1);}

/* Inner content */
.cert-root .c-inn{position:relative;z-index:3;padding:16mm 24mm 14mm;display:flex;flex-direction:column;align-items:center;min-height:297mm;}

/* Logo */
.cert-root .c-church-logo{width:110px;height:110px;object-fit:contain;margin-bottom:8px;}

/* Church name */
.cert-root .c-ch1{font-family:'Cinzel',serif;font-size:26px;font-weight:800;color:#1B3A5C;text-align:center;line-height:1.2;letter-spacing:0.5px;}
.cert-root .c-ch2{font-family:'Cinzel',serif;font-size:14px;font-weight:500;color:#1B3A5C;letter-spacing:5px;text-align:center;text-transform:uppercase;margin-top:2px;}

/* Gradient lines */
.cert-root .c-gr{width:60%;height:2px;margin:14px auto;background:linear-gradient(90deg,transparent,#C5973E,transparent);}
.cert-root .c-gr-s{width:40%;height:1px;margin:8px auto;background:linear-gradient(90deg,transparent,#C5973E,transparent);}

/* Certificate title */
.cert-root .c-ct{font-family:'Cinzel Decorative',serif;font-size:22px;font-weight:400;color:#6B1D2A;text-align:center;letter-spacing:2px;}

/* Location */
.cert-root .c-loc{font-family:'Cormorant Garamond',serif;font-size:15px;color:#7A6A5E;text-align:center;font-style:italic;margin:6px 0;}

/* Body */
.cert-root .c-bd{font-family:'Cormorant Garamond',serif;font-size:16.5px;color:#3D2B1F;text-align:center;line-height:2;max-width:480px;margin:6px auto 0;}
.cert-root .c-bd .c-nm{font-family:'Cinzel',serif;font-size:30px;font-weight:700;color:#6B1D2A;display:block;margin:8px 0 4px;letter-spacing:1px;}
.cert-root .c-bd .c-co{font-size:14.5px;color:#7A6A5E;font-style:italic;}
.cert-root .c-bd .c-pa{font-size:18px;font-weight:600;color:#3D2B1F;display:block;margin:2px 0 12px;}
.cert-root .c-bd .c-dt{font-size:15.5px;margin:3px 0;display:block;}
.cert-root .c-bd .c-dt b{color:#6B1D2A;font-weight:600;}
.cert-root .c-bd .c-dt .c-lb{color:#7A6A5E;font-style:italic;font-size:13px;}

/* Register */
.cert-root .c-rg{font-size:14px;color:#7A6A5E;text-align:center;margin-top:10px;font-style:italic;}

/* Section header (marriage) */
.cert-root .c-shdr{font-family:'Cinzel',serif;font-size:12px;color:#6B1D2A;letter-spacing:4px;text-align:center;margin:10px 0 4px;padding:4px 20px;border-top:1px solid rgba(197,151,62,0.3);border-bottom:1px solid rgba(197,151,62,0.3);background:linear-gradient(90deg,transparent,rgba(245,236,215,0.4),transparent);text-transform:uppercase;width:100%;max-width:490px;}

/* Field table (marriage) */
.cert-root .c-ft{width:100%;max-width:490px;border-collapse:collapse;margin:4px auto;}
.cert-root .c-ft td{padding:6px 4px;vertical-align:bottom;}
.cert-root .c-ft .c-lc{width:38%;font-family:'Cormorant Garamond',serif;font-size:14px;color:#7A6A5E;font-style:italic;}
.cert-root .c-ft .c-vc{width:62%;border-bottom:1px dotted rgba(197,151,62,0.4);font-family:'Cormorant Garamond',serif;font-size:15px;color:#2C1810;}

/* Signatures */
.cert-root .c-sigs{display:flex;justify-content:space-between;width:100%;margin-top:auto;padding-top:24px;}
.cert-root .c-si{text-align:center;width:40%;}
.cert-root .c-si-ln{width:100%;height:1px;background:#3D2B1F;margin-bottom:5px;margin-top:48px;}
.cert-root .c-si-e{font-family:'Cormorant Garamond',serif;font-size:14px;color:#7A6A5E;font-style:italic;}

/* QR */
.cert-root .c-qr{margin-top:12px;text-align:center;}
.cert-root .c-qr-b{width:58px;height:58px;margin:0 auto;border:1.5px solid #C5973E;display:flex;align-items:center;justify-content:center;background:#fff;}
.cert-root .c-qr-l{font-size:10px;color:#7A6A5E;margin-top:2px;font-style:italic;}

/* Motto */
.cert-root .c-motto{font-family:'Cormorant Garamond',serif;font-size:14px;font-style:italic;color:#C5973E;letter-spacing:3px;text-align:center;margin-top:8px;}

/* Print */
@media print{
  .cert-root{position:static;background:#fff;}
  .cert-root .c-nav{display:none!important;}
  .cert-root .c-pg{margin:0;box-shadow:none;page-break-after:always;page-break-inside:avoid;width:100%;}
  .cert-root .c-bg,.cert-root .c-bdr,.cert-root .c-bdr::before,.cert-root .c-bdr::after,.cert-root .c-shdr{print-color-adjust:exact;-webkit-print-color-adjust:exact;}
}

/* Mobile */
@media(max-width:800px){
  .cert-root .c-pg{width:96vw;min-height:auto;margin:68px auto 16px;}
  .cert-root .c-inn{padding:10mm 10mm;}
  .cert-root .c-cr{width:48px;height:48px;}
  .cert-root .c-tl{top:5mm;left:5mm;}.cert-root .c-tr{top:5mm;right:5mm;}.cert-root .c-bl{bottom:5mm;left:5mm;}.cert-root .c-br{bottom:5mm;right:5mm;}
  .cert-root .c-ch1{font-size:19px;}
  .cert-root .c-ct{font-size:17px;}
  .cert-root .c-bd .c-nm{font-size:22px;}
  .cert-root .c-church-logo{width:80px;height:80px;}
}
`;

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */
export default function CertificatePreview() {
  const { sacramentId } = useParams<{ sacramentId: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<CertData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600;700;800;900&family=Cinzel+Decorative:wght@400;700;900&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500&family=Noto+Sans+Oriya:wght@400;700&display=swap';
    document.head.appendChild(link);
    return () => { document.head.removeChild(link); };
  }, []);

  useEffect(() => {
    if (!sacramentId) return;
    certificatesApi.getData(sacramentId)
      .then(r => setData(r.data))
      .catch(() => setError('Certificate data not found'))
      .finally(() => setLoading(false));
  }, [sacramentId]);

  if (loading) {
    return (
      <div className="cert-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <style>{CERT_CSS}</style>
        <div style={{ fontSize: 48, animation: 'certUp 1s infinite alternate' }}>✝</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="cert-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', flexDirection: 'column', gap: 16 }}>
        <style>{CERT_CSS}</style>
        <p style={{ fontFamily: 'Cinzel, serif', fontSize: 18, color: '#6B1D2A' }}>{error || 'No data'}</p>
        <button onClick={() => navigate(-1)} style={{ fontFamily: 'Cinzel, serif', padding: '8px 24px', background: '#6B1D2A', color: '#E8D5A3', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
          Go Back
        </button>
      </div>
    );
  }

  const title = CERT_TITLES[data.sacramentCode] || `Certificate of ${data.sacramentName}`;

  return (
    <div className="cert-root">
      <style>{CERT_CSS}</style>

      {/* Navigation bar */}
      <div className="c-nav">
        <span className="c-logo">✝ SACRAMENTS</span>
        <button onClick={() => navigate(-1)}>← Back</button>
        <button className="c-pb" onClick={() => window.print()}>🖨 Print</button>
      </div>

      {/* Certificate page */}
      <div className="c-pg">
        <div className="c-bg"></div>
        <div className="c-wm">✝</div>
        <div className="c-bdr"></div>

        {/* Corner ornaments */}
        <div className="c-cr c-tl"><CornerSvg /></div>
        <div className="c-cr c-tr"><CornerSvg /></div>
        <div className="c-cr c-bl"><CornerSvg /></div>
        <div className="c-cr c-br"><CornerSvg /></div>

        {/* Content */}
        <div className="c-inn">
          {/* Dynamic parish logo from admin settings */}
          {data.logoPath && (
            <img className="c-church-logo" src={data.logoPath} alt="Church Seal" />
          )}

          {/* Dynamic parish name from admin settings */}
          <div className="c-ch1">{data.parishName}</div>
          {data.diocese && <div className="c-ch2">{data.diocese}</div>}

          <div className="c-gr"></div>
          <div className="c-ct">{title}</div>
          <div className="c-gr-s"></div>

          {/* Sacrament-specific body */}
          <CertBody d={data} />

          <div className="c-gr" style={{ marginTop: 16 }}></div>

          {/* Signatures */}
          <div className="c-sigs">
            <div className="c-si">
              <div className="c-si-ln"></div>
              <div className="c-si-e">Parish Priest</div>
            </div>
            <div className="c-si">
              <div className="c-si-ln"></div>
              <div className="c-si-e">Parish Secretary</div>
            </div>
          </div>

          {/* QR code */}
          <div className="c-qr">
            <div className="c-qr-b">
              {data.qrDataUrl ? (
                <img src={data.qrDataUrl} alt="QR Code" style={{ width: 54, height: 54 }} />
              ) : (
                <QrIcon />
              )}
            </div>
            <div className="c-qr-l">Scan to verify</div>
          </div>

          {/* Motto */}
          <div className="c-motto">Ad Majorem Dei Gloriam</div>
        </div>
      </div>
    </div>
  );
}
