import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { certificatesApi } from '../api/client';

interface VerifyResult {
  valid: boolean;
  certificate?: {
    generated_at: string;
    sacrament_name: string;
    first_name: string;
    last_name: string;
    date: string;
    parish_name: string;
    hash_or_qr_token: string;
  };
  message?: string;
}

export default function Verify() {
  const { token } = useParams<{ token: string }>();
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    certificatesApi.verify(token!).then(r => setResult(r.data)).catch(() => setResult({ valid: false, message: 'Certificate not found or invalid token.' })).finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="min-h-screen bg-navy-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">✝</div>
          <h1 className="font-serif text-2xl font-bold text-gold-400">Certificate Verification</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          {loading ? (
            <div className="text-center py-8">
              <div className="text-3xl mb-3 animate-pulse">✝</div>
              <p className="text-gray-500">Verifying certificate…</p>
            </div>
          ) : result?.valid ? (
            <div>
              <div className="flex items-center gap-3 mb-6 bg-green-50 rounded-xl p-4">
                <span className="text-3xl">✅</span>
                <div>
                  <p className="font-semibold text-green-800">Certificate is Valid</p>
                  <p className="text-sm text-green-600">This certificate is authentic and on record.</p>
                </div>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between border-b pb-2">
                  <span className="text-gray-500">Person:</span>
                  <span className="font-medium">{result.certificate?.first_name} {result.certificate?.last_name}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-gray-500">Sacrament:</span>
                  <span className="font-medium">{result.certificate?.sacrament_name}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-gray-500">Date:</span>
                  <span className="font-medium">{result.certificate?.date ? new Date(result.certificate.date).toLocaleDateString() : '—'}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-gray-500">Parish:</span>
                  <span className="font-medium">{result.certificate?.parish_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Issued:</span>
                  <span className="font-medium">{result.certificate?.generated_at ? new Date(result.certificate.generated_at).toLocaleDateString() : '—'}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 bg-red-50 rounded-xl p-4">
              <span className="text-3xl">❌</span>
              <div>
                <p className="font-semibold text-red-800">Certificate Not Valid</p>
                <p className="text-sm text-red-600">{result?.message || 'This certificate could not be verified.'}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
