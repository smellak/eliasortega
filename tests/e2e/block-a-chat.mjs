/**
 * BLOQUE A: CHAT PÚBLICO — 10 proveedores reservando citas
 * Desktop (1400x900) + Mobile (375x812)
 * All provider emails use @test.com domains
 *
 * Includes retry logic + server health checks to handle container restarts
 */
import {
  BASE, launchBrowser, newContext, snap, scrollChatToBottom,
  sendChatMessage, log, saveResults, TestResults, waitForServer,
} from './helpers.mjs';

// ── Test definitions ──────────────────────────────────────────────
const TESTS = [
  {
    id: 'A1', name: 'Tapicería Jaén — flujo completo',
    msgs: [
      { text: 'Hola buenas, soy José Antonio de Tapicería Jaén', label: 'reconocimiento' },
      { text: 'Traigo 20 sofás y 5 sillones, unos 25 bultos en total', label: 'mercancia' },
      { text: 'Tengo 2 albaranes', label: 'albaranes' },
      { text: 'El lunes que viene, primera hora', label: 'disponibilidad' },
      { text: 'Vale, confirma', label: 'confirmado' },
      { text: 'Mi email es test-jaen@test.com', label: 'final' },
    ],
  },
  {
    id: 'A2', name: 'Mengualba — agencia electro Delonghi',
    msgs: [
      { text: 'Buenas, soy Carmen de Mengualba, traemos mercancía de Delonghi', label: 'reconocimiento' },
      { text: '45 bultos de electrodomésticos, 3 albaranes', label: 'mercancia' },
      { text: 'El miércoles de esta semana si hay hueco', label: 'dia' },
      { text: 'A las 10 si puede ser', label: 'hora' },
      { text: 'Mi email es test-mengualba@test.com', label: 'email' },
      { text: 'Vale, confirma por favor', label: 'confirmado' },
    ],
  },
  {
    id: 'A3', name: 'Transportes Mediterráneo — proveedor nuevo',
    msgs: [
      { text: 'Hola, somos Transportes Mediterráneo, es la primera vez que llamamos', label: 'presentacion' },
      { text: 'Traemos 30 muebles de cocina', label: 'mercancia' },
      { text: 'No sé cuántos albaranes, no lo tengo a mano', label: 'albaranes' },
      { text: 'El jueves de la semana que viene', label: 'dia' },
      { text: 'Mi email es test-mediterraneo@test.com', label: 'email' },
      { text: 'Sí, perfecto, confirma', label: 'confirmado' },
    ],
  },
  {
    id: 'A4', name: 'Pedro Ortiz — tráiler completo',
    msgs: [
      { text: 'Soy de Pedro Ortiz, tráiler completo, 180 bultos de tapicería', label: 'presentacion' },
      { text: 'Tenemos 6 albaranes', label: 'albaranes' },
      { text: 'Viernes primera hora si hay sitio', label: 'dia' },
      { text: 'Mi email es test-pedroortiz@test.com', label: 'email' },
      { text: 'Sí, confirma', label: 'confirmado' },
    ],
  },
  {
    id: 'A5', name: 'DHL PAE — entrega pequeña',
    msgs: [
      { text: 'Buenas, de DHL, traigo 10 paquetes de pequeño electrodoméstico', label: 'presentacion' },
      { text: '2 albaranes, cosa rápida', label: 'mercancia' },
      { text: 'Mañana si puede ser', label: 'dia' },
      { text: 'Mi email es test-dhl@test.com', label: 'email' },
      { text: 'Perfecto, confirma', label: 'confirmado' },
    ],
  },
  {
    id: 'A6', name: 'Colchones del Sur — cambia de opinión',
    msgs: [
      { text: 'Soy de Colchones del Sur, traigo 80 colchones', label: 'presentacion' },
      { text: 'Para el lunes que viene', label: 'dia1' },
      { text: 'No, mejor el martes', label: 'cambio-dia' },
      { text: 'Ah espera, en realidad son 120 colchones, no 80', label: 'cambio-cantidad' },
      { text: 'Tengo 4 albaranes. Mi email es test-colchones@test.com', label: 'email' },
      { text: 'Vale, confirma', label: 'confirmado' },
    ],
  },
  {
    id: 'A7', name: 'Proveedor pide domingo',
    msgs: [
      { text: 'Hola, necesito descargar el domingo', label: 'domingo' },
      { text: 'Entonces el lunes a primera', label: 'lunes' },
      { text: 'Traigo 40 bultos de mobiliario, 2 albaranes', label: 'mercancia' },
      { text: 'Mi email es test-prov7@test.com', label: 'email' },
      { text: 'Confirma por favor', label: 'confirmado' },
    ],
  },
  {
    id: 'A8', name: 'Fecha pasada',
    msgs: [
      { text: 'Hola, quiero reservar para el 15 de enero', label: 'fecha-pasada' },
      { text: 'Perdona, quería decir el 15 del mes que viene', label: 'correccion' },
      { text: 'Traigo 30 bultos de decoración, 2 albaranes', label: 'mercancia' },
      { text: 'Mi email es test-prov8@test.com', label: 'email' },
      { text: 'Confirma', label: 'confirmado' },
    ],
  },
  {
    id: 'A9', name: 'CODECO — carga grande electro',
    msgs: [
      { text: 'Somos de CODECO, 200 electrodomésticos, 8 albaranes', label: 'presentacion' },
      { text: 'Lunes de la semana que viene', label: 'dia' },
      { text: 'Mi email es test-codeco@test.com', label: 'email' },
      { text: 'Sí, confirma', label: 'confirmado' },
    ],
  },
  {
    id: 'A10', name: 'Jancor — concurrencia',
    msgs: [
      { text: 'Hola, de Jancor, traemos 50 colchones, 3 albaranes', label: 'presentacion' },
      { text: 'El lunes que viene a primera hora', label: 'dia' },
      { text: 'Mi email es test-jancor@test.com', label: 'email' },
      { text: 'Vale, confirma lo que haya', label: 'confirmado' },
    ],
  },
];

// ── Run a single chat test ────────────────────────────────────────
async function runChatTest(browser, test, viewport) {
  const suffix = viewport === 'desktop' ? '' : `-${viewport}`;
  const testLabel = `${test.id}${suffix}`;
  log(testLabel, `▶ ${test.name} (${viewport})`);

  // Wait for server to be healthy before starting
  const serverOk = await waitForServer(60000);
  if (!serverOk) {
    log(testLabel, '❌ Server unreachable, skipping');
    return { testId: testLabel, status: 'FAIL', notes: 'Server unreachable', screenshots: [], responses: [] };
  }

  const ctx = await newContext(browser, viewport);
  const page = await ctx.newPage();
  const screenshots = [];
  const responses = [];
  let status = 'PASS';
  let notes = '';

  try {
    await page.goto(`${BASE}/chat`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    screenshots.push(await snap(page, `${test.id}-01-inicio${suffix}`));

    let step = 2;
    for (const msg of test.msgs) {
      try {
        const response = await sendChatMessage(page, msg.text, 120000);
        responses.push({ label: msg.label, response: response.slice(0, 300) });

        // Check for error responses (server crashed mid-conversation)
        if (response.includes('network error') || response.includes('Failed to fetch') || response.includes('HTTP 5')) {
          log(testLabel, `⚠️ Server error at step ${step}, waiting for recovery...`);
          await waitForServer(90000);
          status = 'PARTIAL';
          notes += `Step ${step}(${msg.label}): server error. `;
        }

        await scrollChatToBottom(page);
        const snapName = `${test.id}-${String(step).padStart(2, '0')}-${msg.label}${suffix}`;
        screenshots.push(await snap(page, snapName));
        step++;
      } catch (e) {
        log(testLabel, `❌ Step ${step} (${msg.label}): ${e.message}`);
        try {
          screenshots.push(await snap(page, `${test.id}-${String(step).padStart(2, '0')}-${msg.label}-ERROR${suffix}`));
        } catch {}
        status = 'PARTIAL';
        notes += `Step ${step}(${msg.label}): ${e.message.slice(0, 60)}. `;
        step++;

        // If connection error, wait for server
        if (e.message.includes('ERR_CONNECTION') || e.message.includes('502') || e.message.includes('503')) {
          log(testLabel, 'Waiting for server recovery...');
          await waitForServer(90000);
        }
      }
    }

    if (status === 'PASS') {
      notes = `All ${test.msgs.length} steps OK.`;
    }
  } catch (e) {
    log(testLabel, `❌ FAIL: ${e.message}`);
    status = 'FAIL';
    notes = e.message;
    try { screenshots.push(await snap(page, `${test.id}-ERROR${suffix}`)); } catch {}
  } finally {
    await ctx.close();
  }

  // Cooldown between tests to avoid overloading server
  log(testLabel, `${status === 'PASS' ? '✅' : status === 'PARTIAL' ? '⚠️' : '❌'} ${status} — ${notes.slice(0, 80)}`);
  log(testLabel, 'Cooldown 10s...');
  await new Promise(r => setTimeout(r, 10000));

  return { testId: testLabel, status, notes, screenshots, responses };
}

// ── Main ──────────────────────────────────────────────────────────
(async () => {
  console.log('\n' + '═'.repeat(60));
  console.log('  BLOQUE A: CHAT PÚBLICO — 10 proveedores × 2 viewports');
  console.log('  (with retry logic + server health checks)');
  console.log('═'.repeat(60) + '\n');

  const browser = await launchBrowser();
  const results = new TestResults('Bloque A: Chat Público');

  // Phase 1: Desktop
  console.log('\n── DESKTOP (1400×900) ──────────────────────────────\n');
  for (const test of TESTS) {
    const r = await runChatTest(browser, test, 'desktop');
    results.add(r.testId, r.status, r.notes, r.screenshots);
  }

  // Phase 2: Mobile
  console.log('\n── MOBILE (375×812) ────────────────────────────────\n');
  for (const test of TESTS) {
    const r = await runChatTest(browser, test, 'mobile');
    results.add(r.testId, r.status, r.notes, r.screenshots);
  }

  await browser.close();

  results.print();
  saveResults('block-a-results.json', results.summary());

  console.log('\n✅ Bloque A complete.\n');
})();
