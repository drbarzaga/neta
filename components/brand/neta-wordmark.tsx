/**
 * Isotipo de Neta v6 ("coin"): wordmark con trazados fijos (no dependen de
 * fuente) + la "moneda" lima que reemplaza el punto de la "e".
 * Fuente: public/brand/neta-logo-v6-coin(-dark).svg — no redibujar los trazos.
 *
 * Hay dos familias de componentes:
 * - `NetaWordmark` / `NetaMark`: siguen el tema global (next-themes, clase
 *   `.dark`). Usarlos donde el logo se apoya sobre un fondo que cambia con
 *   el tema (ej. la pantalla de login).
 * - `NetaWordmarkDark` / `NetaMarkDark`: colores fijos para "oscuro", sin
 *   togglear con el tema. Usarlos donde la superficie es siempre oscura sin
 *   importar el tema global (ej. el sidebar, que nunca cambia de color).
 */

const N_PATH =
  'M10.73345259391771 46.85152057245081C10.73345259391771 41.55635062611807 13.917710196779963 38.479427549194995 18.497316636851522 38.479427549194995C23.005366726296955 38.479427549194995 25.724508050089447 41.449016100178895 25.724508050089447 46.422182468694096V70.0H36.45796064400715V44.56171735241503C36.45796064400715 35.18783542039356 31.019677996422182 29.499105545617176 22.719141323792485 29.499105545617176C16.56529516994633 29.499105545617176 12.522361359570661 32.68336314847943 10.268336314847943 38.264758497316635L10.125223613595706 30.0H0.0V70.0H10.73345259391771Z';
const E_RING_PATH = 'M46.96 50.0 H78.96 A16.0 16.0 0 1 0 74.27 61.31';
const T_PATH =
  'M113.1788908765653 30.0H105.70125223613596V20.483005366726296H94.96779964221825V30.0H89.45796064400716V38.193202146690524H94.96779964221825V59.23076923076923C94.96779964221825 66.56529516994634 99.33273703041145 70.57245080500894 107.34704830053667 70.57245080500894C109.49373881932021 70.57245080500894 111.89087656529517 70.32200357781753 114.28801431127013 69.60644007155635L112.74955277280858 61.55635062611807C111.9624329159213 61.77101967799642 110.17352415026835 62.021466905187836 109.35062611806799 62.021466905187836C106.73881932021467 62.021466905187836 105.70125223613596 60.840787119856884 105.70125223613596 58.3005366726297V38.193202146690524H113.1788908765653Z';
const A_PATH =
  'M133.59749552772809 70.7871198568873C139.50089445438283 70.7871198568873 143.3649373881932 68.17531305903398 145.2969588550984 64.45438282647585H145.654740608229V70.0H155.81574239713774V43.05903398926655C155.81574239713774 33.36314847942755 147.44364937388193 29.499105545617176 138.85688729874778 29.499105545617176C129.91234347048302 29.499105545617176 123.47227191413239 33.47048300536673 121.43291592128801 40.41144901610018L131.27191413237927 42.05724508050089C132.13059033989268 39.48121645796064 134.67084078711986 37.44186046511628 138.82110912343472 37.44186046511628C142.8282647584973 37.44186046511628 145.08228980322005 39.37388193202147 145.08228980322005 42.772808586762075V42.95169946332737C145.08228980322005 45.56350626118068 142.25581395348837 45.84973166368515 135.38640429338105 46.529516994633276C127.51520572450806 47.280858676207515 120.28801431127013 49.856887298747765 120.28801431127013 58.80143112701252C120.28801431127013 66.70840787119857 125.97674418604652 70.7871198568873 133.59749552772809 70.7871198568873ZM136.63864042933812 63.23792486583184C133.09660107334525 63.23792486583184 130.59212880143113 61.627906976744185 130.59212880143113 58.51520572450805C130.59212880143113 55.295169946332734 133.2397137745975 53.7567084078712 137.21109123434707 53.18425760286225C139.57245080500894 52.86225402504472 143.83005366726297 52.28980322003578 145.15384615384616 51.35957066189624V55.688729874776385C145.15384615384616 59.910554561717355 141.64758497316637 63.23792486583184 136.63864042933812 63.23792486583184Z';

const WORDMARK_VIEWBOX = '-2 18 159.82 62';

function Letters({ fill }: { fill: string }) {
  return (
    <>
      <path fill={fill} d={N_PATH} />
      <path fill="none" stroke={fill} strokeWidth="9" d={E_RING_PATH} />
      <path fill={fill} d={T_PATH} />
      <path fill={fill} d={A_PATH} />
    </>
  );
}

/** La "moneda": lima con un anillo interior. `ring` es el color del trazo interno. */
function Coin({ ring }: { ring: string }) {
  return (
    <g>
      <circle cx="74.27" cy="61.31" r="6.2" fill="#C8F169" stroke={ring} strokeWidth="1.6" />
      <circle cx="74.27" cy="61.31" r="3" fill="none" stroke={ring} strokeWidth="1.1" />
    </g>
  );
}

function WordmarkLight({ className }: { className?: string }) {
  return (
    <svg viewBox={WORDMARK_VIEWBOX} className={className} role="img" aria-label="neta">
      <Letters fill="#0F5A3E" />
      <Coin ring="#0F5A3E" />
    </svg>
  );
}

function WordmarkDark({ className }: { className?: string }) {
  return (
    <svg viewBox={WORDMARK_VIEWBOX} className={className} role="img" aria-label="neta">
      <Letters fill="#F3EEE4" />
      <Coin ring="#0E1512" />
    </svg>
  );
}

/** Wordmark completo "neta", siguiendo el tema global (claro/oscuro). */
export function NetaWordmark({ className }: { className?: string }) {
  return (
    <>
      <WordmarkLight className={`${className ?? ''} dark:hidden`} />
      <WordmarkDark className={`hidden dark:block ${className ?? ''}`} />
    </>
  );
}

/** Wordmark completo "neta", siempre con los colores de fondo oscuro (sidebar). */
export function NetaWordmarkDark({ className }: { className?: string }) {
  return <WordmarkDark className={className} />;
}

/** Solo la moneda: para el sidebar colapsado y otros espacios cuadrados chicos. Sigue el tema. */
export function NetaMark({ className }: { className?: string }) {
  return (
    <>
      <svg viewBox="62 49 24.6 24.6" className={`${className ?? ''} dark:hidden`} role="img" aria-label="neta">
        <Coin ring="#0F5A3E" />
      </svg>
      <svg viewBox="62 49 24.6 24.6" className={`hidden dark:block ${className ?? ''}`} role="img" aria-label="neta">
        <Coin ring="#0E1512" />
      </svg>
    </>
  );
}

/** Solo la moneda, siempre con el trazo interno oscuro (sidebar). */
export function NetaMarkDark({ className }: { className?: string }) {
  return (
    <svg viewBox="62 49 24.6 24.6" className={className} role="img" aria-label="neta">
      <Coin ring="#0E1512" />
    </svg>
  );
}
