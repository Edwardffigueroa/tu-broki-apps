# Auth OTP · checklist Dashboard (tubroki-apps)

Proyecto: `qovcebutzhovuxcqtdkb` · [Auth Templates](https://supabase.com/dashboard/project/qovcebutzhovuxcqtdkb/auth/templates) · [URL Config](https://supabase.com/dashboard/project/qovcebutzhovuxcqtdkb/auth/url-configuration)

## 1. Template Magic Link → código OTP

En **Authentication → Email Templates → Magic Link**, reemplaza el cuerpo por:

```html
<h2>Tu código de acceso</h2>
<p>Ingresa este código en TuBroki Apps:</p>
<p style="font-size:24px;font-weight:bold;letter-spacing:4px">{{ .Token }}</p>
<p>Vence en unos minutos. Si no pediste entrar, ignora este correo.</p>
```

Sin `{{ .Token }}` el correo no muestra el código que pide `/acceso`.

## 2. Site URL y redirects

- Site URL: dominio de producción de las apps (o `http://127.0.0.1:4747` mientras pruebas local).
- Redirect URLs: `http://127.0.0.1:4747/**` y `https://<tu-dominio-vercel>/**`.

## 3. Variables en Vercel

Añade (Production + Preview):

| Variable | Origen |
|---|---|
| `SUPABASE_URL` | `https://qovcebutzhovuxcqtdkb.supabase.co` |
| `SUPABASE_ANON_KEY` | Project Settings → API → anon / publishable |
| `APPS_ALLOWED_EMAILS` | `edwardfigueroavelasco@gmail.com,soporte@tubroki.com,mayralejandrarm@hotmail.com,andreapatino305@gmail.com` |
| `SESSION_SECRET` | ya existente |
| `DATABASE_URL` | ya existente |

Quita `APPS_PASSWORD` de Vercel cuando confirmes que el OTP funciona.

## 4. Probar

1. `npm run dev` → abre `/acceso`
2. Usa un correo de la allowlist → debe llegar el código
3. Verifica → redirige al launcher con sesión activa
