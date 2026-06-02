# 🧀 MAHER — Gestión empresarial Quesos Maher SL

App de gestión empresarial: facturación, gastos, presupuestos, informes fiscales españoles, multi-usuario.

## Stack
- React 18 + Vite
- Supabase (PostgreSQL + Auth)
- Vercel (hosting)

## 🚀 Puesta en marcha local

### 1. Instalar dependencias
```bash
npm install
```

### 2. Configurar variables de entorno
Copia `.env.example` como `.env` y rellena con tus claves de Supabase:
```bash
cp .env.example .env
```
Edita `.env`:
```
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
```

### 3. Arrancar en desarrollo
```bash
npm run dev
```
Abre http://localhost:5173

### 4. Build de producción
```bash
npm run build
```

## 🗄️ Base de datos
El esquema SQL está en `supabase_schema.sql`. Ejecútalo en el SQL Editor de Supabase antes de usar la app.

## 🌐 Despliegue en Vercel
1. Sube este repo a GitHub
2. En Vercel: New Project → importar el repo
3. Añade las variables de entorno `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`
4. Deploy

## 📁 Estructura
```
maher-app/
├── public/
│   └── favicon.svg
├── src/
│   ├── lib/
│   │   ├── supabase.js     # Cliente Supabase
│   │   └── api.js          # Capa de acceso a datos (CRUD)
│   ├── hooks/
│   │   ├── useAuth.js      # Autenticación
│   │   └── useColeccion.js # Hook genérico de datos
│   ├── App.jsx             # App principal
│   ├── Login.jsx           # Pantalla de login
│   └── main.jsx            # Punto de entrada
├── .env.example            # Plantilla de variables (SÍ se sube)
├── .gitignore              # Ignora .env y node_modules
├── index.html
├── package.json
└── vite.config.js
```

## 🔐 Seguridad
- El archivo `.env` con las claves NUNCA se sube a GitHub (está en `.gitignore`)
- Row Level Security (RLS) en Supabase: cada usuario solo accede a datos de su empresa
- Autenticación real con email/contraseña vía Supabase Auth
