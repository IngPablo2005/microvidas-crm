// Paleta validada (skill dataviz) — slots categóricos en orden fijo
export const CATEGORICAL = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'];

export const SEQUENTIAL_BLUE = ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95', '#0d366b'];

export const STATUS = {
  good: '#0ca30c',
  warning: '#fab219',
  serious: '#ec835a',
  critical: '#d03b3b',
};

export const INK = {
  primary: '#0b0b0b',
  secondary: '#52514e',
  muted: '#898781',
  grid: '#e1e0d9',
  baseline: '#c3c2b7',
  surface: '#fcfcfb',
  page: '#f9f9f7',
  successText: '#006300',
};

export const ESTADO_COLOR = {
  Activo: STATUS.good,
  Inactivo: INK.muted,
  Perdido: STATUS.critical,
  Nuevo: CATEGORICAL[0],
  Contactado: CATEGORICAL[3],
  Calificado: CATEGORICAL[2],
  Cotizacion: CATEGORICAL[6],
  Negociacion: CATEGORICAL[1],
  Ganado: STATUS.good,
  Ganada: STATUS.good,
  Perdida: STATUS.critical,
  Borrador: INK.muted,
  Enviada: CATEGORICAL[0],
  'En negociacion': CATEGORICAL[1],
  Aceptada: STATUS.good,
  Rechazada: STATUS.critical,
  Vencida: STATUS.critical,
  Pendiente: CATEGORICAL[3],
  'En proceso': CATEGORICAL[0],
  Completada: STATUS.good,
  Pagada: STATUS.good,
  Cumplido: STATUS.good,
  Incumplido: STATUS.critical,
};
