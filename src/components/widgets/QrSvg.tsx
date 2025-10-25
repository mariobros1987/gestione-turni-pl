import React, { useEffect, useState } from 'react';

interface QrSvgProps {
  value: string;
  size?: number;
  ecLevel?: 'L' | 'M' | 'Q' | 'H';
}

const QrSvg: React.FC<QrSvgProps> = ({ value, size = 256, ecLevel = 'M' }) => {
  const [svg, setSvg] = useState('');

  useEffect(() => {
    // Carica qrcode-generator da CDN solo lato client
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js';
    script.async = true;
    script.onload = () => {
      // @ts-ignore
      const QRCodeGen = window.qrcode;
      if (!QRCodeGen) return;
      const qr = QRCodeGen(0, ecLevel);
      qr.addData(value);
      qr.make();
      setSvg(qr.createSvgTag({ cellSize: size / qr.getModuleCount(), margin: 2 }));
    };
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, [value, size, ecLevel]);

  return (
    <div dangerouslySetInnerHTML={{ __html: svg }} style={{ display: 'inline-block' }} />
  );
};

export default QrSvg;
