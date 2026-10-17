/**
 * Boceto genérico (line-art) de una crossover/SUV en perfil, para la página
 * de /auto. No reproduce ningún logo ni modelo real: es una silueta
 * estilizada que toma el color del vehículo como acento.
 */
export function VehicleSketch({
  color = '#2563eb',
  className,
}: {
  color?: string;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 400 190"
      fill="none"
      className={className}
      role="img"
      aria-label="Boceto del vehículo"
    >
      {/* Sombra de piso */}
      <ellipse cx="200" cy="183" rx="175" ry="6" fill="currentColor" className="text-foreground/10" />

      {/* Carrocería */}
      <path
        d="M 60 150
           C 60 134 66 122 78 116
           L 96 106
           C 112 84 146 70 188 68
           L 248 67
           C 276 68 296 76 312 92
           C 326 104 336 118 340 134
           C 342 140 342 146 340 150
           L 60 150
           Z"
        className="text-muted-foreground/70"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />

      {/* Línea de carácter / zócalo (look SUV) */}
      <path
        d="M 70 136 L 334 136"
        className="text-muted-foreground/40"
        stroke="currentColor"
        strokeWidth="1.5"
      />

      {/* Habitáculo / vidrios */}
      <path
        d="M 110 100
           L 130 79
           C 150 73 190 70 236 70
           C 262 70 282 76 298 90
           L 302 100
           Z"
        fill={color}
        fillOpacity="0.12"
        stroke="currentColor"
        strokeWidth="2"
        className="text-muted-foreground/70"
        strokeLinejoin="round"
      />
      {/* Parantes (A/B/C pilar) */}
      <path d="M 176 72 L 170 100" stroke="currentColor" strokeWidth="2" className="text-muted-foreground/70" />
      <path d="M 248 71 L 250 100" stroke="currentColor" strokeWidth="2" className="text-muted-foreground/70" />

      {/* Rieles de techo */}
      <path d="M 150 63 L 272 62" stroke={color} strokeWidth="2.5" strokeLinecap="round" opacity="0.8" />
      <path d="M 158 63 L 158 67" stroke={color} strokeWidth="2.5" opacity="0.8" />
      <path d="M 262 62 L 262 66" stroke={color} strokeWidth="2.5" opacity="0.8" />

      {/* Manijas */}
      <rect x="160" y="109" width="16" height="3.5" rx="1.75" className="fill-muted-foreground/60" />
      <rect x="226" y="109" width="16" height="3.5" rx="1.75" className="fill-muted-foreground/60" />

      {/* Óptica delantera / trasera */}
      <rect x="83" y="119" width="16" height="9" rx="3" fill={color} opacity="0.85" />
      <rect x="322" y="113" width="14" height="8" rx="3" fill={color} opacity="0.6" />

      {/* Paragolpe delantero (acento) */}
      <path d="M 62 146 L 84 146" stroke={color} strokeWidth="3" strokeLinecap="round" />

      {/* Ruedas */}
      {[120, 290].map((cx) => (
        <g key={cx}>
          <circle
            cx={cx}
            cy="150"
            r="27"
            className="fill-background text-muted-foreground"
            stroke="currentColor"
            strokeWidth="3"
          />
          <circle cx={cx} cy="150" r="10" fill={color} opacity="0.75" />
        </g>
      ))}

      {/* Línea de piso */}
      <line x1="20" y1="178" x2="380" y2="178" className="text-muted-foreground/25" stroke="currentColor" strokeWidth="2" strokeDasharray="2 5" strokeLinecap="round" />
    </svg>
  );
}
