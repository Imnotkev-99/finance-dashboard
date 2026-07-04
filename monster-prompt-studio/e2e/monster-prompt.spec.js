// E2E regression suite for the prompt compiler. Everything here drives the
// real page in a real browser (no DOM stubs) since compilePrompt() /
// calculateScore() are closures over the live DOM, not pure exported
// functions — see README note in this folder for why unit tests weren't
// the right shape here.
import { test, expect } from '@playwright/test';

const IDEA = 'Un gato ciberpunk en una azotea lluviosa de noche';

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
});

test.describe('Estado inicial', () => {
  test('muestra el placeholder y 0% de score al cargar', async ({ page }) => {
    await expect(page.locator('#outputPrompt')).toContainText('Ingresa tu idea');
    await expect(page.locator('#scoreNumber')).toHaveText('0%');
  });
});

test.describe('Compilador de texto', () => {
  test('Gemini (default): compila con rol, restricciones y formato de salida explícito', async ({ page }) => {
    await page.locator('#userIdea').fill(IDEA);
    await expect(page.locator('#outputPrompt')).toContainText('INSTURCCIÓN DE SISTEMA MAESTRA (GEMINI OPTIMIZED)');
    await expect(page.locator('#outputPrompt')).toContainText('FORMATO DE SALIDA ESPERADO');
    await expect(page.locator('#diagPersona')).toHaveClass(/success/);
    await expect(page.locator('#diagConstraints')).toHaveClass(/success/);
    await expect(page.locator('#diagOutput')).toHaveClass(/success/);
    await expect(page.locator('#scoreNumber')).toHaveText('100%');
  });

  test('Claude: incluye system_instructions y marca el formato de salida', async ({ page }) => {
    await page.locator('#userIdea').fill(IDEA);
    await page.locator('#textTargetGroup [data-text-target="claude"]').click();
    await expect(page.locator('#outputPrompt')).toContainText('<system_instructions>');
    await expect(page.locator('#diagOutput')).toHaveClass(/success/);
  });

  test('Grok: incluye el system prompt de xAI y marca el formato de salida', async ({ page }) => {
    await page.locator('#userIdea').fill(IDEA);
    await page.locator('#textTargetGroup [data-text-target="grok"]').click();
    await expect(page.locator('#outputPrompt')).toContainText('SYSTEM PROMPT (GROK / xAI OPTIMIZED)');
    await expect(page.locator('#diagOutput')).toHaveClass(/success/);
    await expect(page.locator('#scoreNumber')).toHaveText('100%');
  });
});

test.describe('Compilador de imagen', () => {
  test('Midjourney: incluye parámetros --ar/--s/--c y marca restricciones', async ({ page }) => {
    await page.locator('#userIdea').fill(IDEA);
    await page.locator('#modalityGroup [data-modality="image"]').click();
    await expect(page.locator('#outputPrompt')).toContainText('--ar 16:9');
    await expect(page.locator('#outputPrompt')).toContainText('--s 250');
    await expect(page.locator('#diagConstraints')).toHaveClass(/success/);
  });

  test('Flux sin negative prompt: no marca restricciones; al añadir negative prompt sí', async ({ page }) => {
    await page.locator('#userIdea').fill(IDEA);
    await page.locator('#modalityGroup [data-modality="image"]').click();
    await page.locator('#imageTargetGroup [data-image-target="flux"]').click();
    await expect(page.locator('#diagConstraints')).not.toHaveClass(/success/);

    await page.locator('#negativePromptInput').fill('manos deformes, baja calidad');
    await expect(page.locator('#outputPrompt')).toContainText('Negative Prompt (evitar):** manos deformes, baja calidad');
    await expect(page.locator('#diagConstraints')).toHaveClass(/success/);
  });

  test('DALL-E: renderiza la línea de negative prompt', async ({ page }) => {
    await page.locator('#userIdea').fill(IDEA);
    await page.locator('#modalityGroup [data-modality="image"]').click();
    await page.locator('#imageTargetGroup [data-image-target="dalle"]').click();
    await page.locator('#negativePromptInput').fill('texto borroso');
    await expect(page.locator('#outputPrompt')).toContainText('Negative Prompt (evitar):** texto borroso');
  });

  test('Google Imagen: renderiza la línea de negative prompt', async ({ page }) => {
    await page.locator('#userIdea').fill(IDEA);
    await page.locator('#modalityGroup [data-modality="image"]').click();
    await page.locator('#imageTargetGroup [data-image-target="imagen"]').click();
    await page.locator('#negativePromptInput').fill('marcas de agua');
    await expect(page.locator('#outputPrompt')).toContainText('Negative Prompt (evitar):** marcas de agua');
  });
});

test.describe('Compilador de video', () => {
  test('Veo 3: incluye el bloque de diseño de sonido nativo', async ({ page }) => {
    await page.locator('#userIdea').fill(IDEA);
    await page.locator('#modalityGroup [data-modality="video"]').click();
    await page.locator('#videoTargetGroup [data-video-target="veo3"]').click();
    await expect(page.locator('#outputPrompt')).toContainText('PROMPT COMPILADO PARA VEO 3');
    await expect(page.locator('#outputPrompt')).toContainText('Diseño de Sonido');
  });
});

test.describe('Reset', () => {
  test('limpia la idea y el negative prompt', async ({ page }) => {
    await page.locator('#userIdea').fill(IDEA);
    await page.locator('#modalityGroup [data-modality="image"]').click();
    await page.locator('#negativePromptInput').fill('marcas de agua');

    await page.locator('#resetBtn').click();

    await expect(page.locator('#userIdea')).toHaveValue('');
    await expect(page.locator('#negativePromptInput')).toHaveValue('');
    await expect(page.locator('#outputPrompt')).toContainText('Ingresa tu idea');
  });
});

test.describe('Historial', () => {
  test('guardar un prompt y restaurarlo desde el historial', async ({ page }) => {
    await page.locator('#userIdea').fill(IDEA);
    await page.locator('#saveHistoryBtn').click();

    await page.locator('.tab-btn[data-tab="history"]').click();
    await expect(page.locator('#historyList .history-item')).toHaveCount(1);

    await page.locator('#userIdea').fill('otra idea distinta');
    await page.locator('#historyList button', { hasText: 'Restaurar' }).click();

    await expect(page.locator('#outputPrompt')).toContainText(IDEA);
  });
});

test.describe('Plantillas', () => {
  test('guardar la configuración actual como plantilla y volver a cargarla', async ({ page }) => {
    await page.locator('#userIdea').fill(IDEA);
    await page.locator('#toneGroup [data-tone="educativo"]').click();

    await page.locator('.tab-btn[data-tab="templates"]').click();
    await page.locator('#templateNameInput').fill('Mi plantilla de prueba');
    await page.locator('#saveTemplateBtn').click();
    await expect(page.locator('#templatesList .history-item')).toHaveCount(1);

    await page.locator('#resetBtn').click();
    await expect(page.locator('#userIdea')).toHaveValue('');

    await page.locator('#templatesList button', { hasText: 'Cargar' }).click();
    await expect(page.locator('#userIdea')).toHaveValue(IDEA);
    await expect(page.locator('#toneGroup [data-tone="educativo"]')).toHaveClass(/active/);
  });
});

test.describe('Compartir por URL', () => {
  test('la URL refleja el estado y al recargarla se restaura la configuración', async ({ page }) => {
    await page.locator('#userIdea').fill(IDEA);
    await page.locator('#modalityGroup [data-modality="image"]').click();
    await page.locator('#imageTargetGroup [data-image-target="flux"]').click();

    await expect(page).toHaveURL(/imageTarget=flux/);
    const shareUrl = page.url();

    await page.goto(shareUrl);
    await expect(page.locator('#userIdea')).toHaveValue(IDEA);
    await expect(page.locator('#imageTargetGroup [data-image-target="flux"]')).toHaveClass(/active/);
  });
});

test.describe('i18n', () => {
  test('cambiar a EN traduce textos estáticos y diagnósticos dinámicos', async ({ page }) => {
    await page.locator('#userIdea').fill(IDEA);
    await page.locator('.language-switch__btn[data-lang="en"]').click();

    await expect(page.locator('[data-i18n="workspace_title"]')).toContainText('Prompt Workspace');
    await expect(page.locator('#diagPersona')).toContainText('Technical role');

    await page.locator('.language-switch__btn[data-lang="es"]').click();
    await expect(page.locator('[data-i18n="workspace_title"]')).toContainText('Espacio de Trabajo');
  });
});

test.describe('Chat en vivo multi-proveedor', () => {
  test('Claude: responde usando la llamada directa a Anthropic (mockeada)', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('claude_api_key', 'sk-ant-test-key');
      localStorage.setItem('chat_provider', 'claude');
    });
    await page.route('https://api.anthropic.com/v1/messages', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ content: [{ type: 'text', text: 'Hola desde Claude (mock)' }] })
      });
    });

    await page.goto('/index.html');
    await expect(page.locator('#chatTabBtn')).toBeVisible();
    await page.locator('#chatTabBtn').click();

    await page.locator('#chatInput').fill('Hola');
    await page.locator('#sendChatBtn').click();

    await expect(page.locator('#chatMessages')).toContainText('Hola desde Claude (mock)');
  });

  test('Gemini (regresión post-refactor): sigue respondiendo tras extraer callGeminiAPI', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('gemini_api_key', 'AIzaTest123');
    });
    await page.route('https://generativelanguage.googleapis.com/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Hola desde Gemini (mock)' }] } }] })
      });
    });

    await page.goto('/index.html');
    await expect(page.locator('#chatTabBtn')).toBeVisible();
    await page.locator('#chatTabBtn').click();

    await page.locator('#chatInput').fill('Hola');
    await page.locator('#sendChatBtn').click();

    await expect(page.locator('#chatMessages')).toContainText('Hola desde Gemini (mock)');
  });

  test('ChatGPT/Grok: muestra el aviso de no disponible en vez de un campo de clave roto', async ({ page }) => {
    await page.locator('#apiConfigBtn').click();
    await expect(page.locator('#apiPanel')).toBeVisible();

    await page.locator('#chatProviderGroup [data-provider="chatgpt"]').click();
    await expect(page.locator('#providerConfigUnavailable')).toBeVisible();
    await expect(page.locator('#providerConfigGemini')).toBeHidden();
    await expect(page.locator('#saveApiKeyBtn')).toBeHidden();

    await page.locator('#chatProviderGroup [data-provider="grok"]').click();
    await expect(page.locator('#providerConfigUnavailable')).toBeVisible();
    await expect(page.locator('#saveApiKeyBtn')).toBeHidden();
  });
});
