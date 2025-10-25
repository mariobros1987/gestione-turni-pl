import React from 'react';

// Semplice generatore QR SVG: solo per codici brevi, non supporta error correction avanzata
// Usa la libreria https://github.com/skip2/go-qrcode come riferimento per la logica avanzata

function simpleQrMatrix(text: string): number[][] {
  // Dummy: matrice 21x21 con pattern alternato (NON funziona per produzione, solo demo!)
  // Sostituire con una vera libreria QR se serve robustezza
  const size = 21;
  const matrix: number[][] = [];
  for (let y = 0; y < size; y++) {
    const row: number[] = [];
    for (let x = 0; x < size; x++) {
      row.push((x + y + text.length) % 2 === 0 ? 1 : 0);
    }
    matrix.push(row);
  }
  return matrix;
}

interface SimpleQrCodeProps {
  value: string;
  size?: number;
}

export const SimpleQrCode: React.FC<SimpleQrCodeProps> = ({ value, size = 256 }) => {
  const matrix = simpleQrMatrix(value);
  const cellSize = size / matrix.length;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ background: '#fff', borderRadius: 8 }}>
      {matrix.map((row, y) =>
        row.map((cell, x) =>
          cell ? (
            <rect key={x + '-' + y} x={x * cellSize} y={y * cellSize} width={cellSize} height={cellSize} fill="#222" />
          ) : null
        )
      )}
    </svg>
  );
};

export default SimpleQrCode;
