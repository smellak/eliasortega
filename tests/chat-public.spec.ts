import { test, expect, Page } from "@playwright/test";

const SCREENSHOT_DIR = "/root/eliasortega/test-results/screenshots";
const AI_TIMEOUT = 90_000;

async function sendMessage(page: Page, message: string) {
  const input = page.locator('textarea, input[placeholder*="mensaje"], input[placeholder*="Escribe"]');
  await input.fill(message);
  // Press Enter to send
  await input.press("Enter");
}

async function waitForResponse(page: Page) {
  // Wait for AI response - look for new assistant message bubble
  // The response might take up to 90 seconds
  await page.waitForTimeout(3000); // Initial wait
  
  // Wait until no more loading indicators
  const maxWait = AI_TIMEOUT;
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWait) {
    // Check if there's a loading/typing indicator
    const isLoading = await page.locator('.animate-pulse, .typing-indicator, [data-loading="true"]').isVisible().catch(() => false);
    if (!isLoading) {
      // Additional wait to ensure response is fully rendered
      await page.waitForTimeout(2000);
      break;
    }
    await page.waitForTimeout(1000);
  }
}

async function getLastAssistantMessage(page: Page): Promise<string> {
  // Get text of the last assistant message
  const messages = page.locator('[class*="assistant"], [data-role="assistant"], .message-assistant');
  const count = await messages.count();
  if (count > 0) {
    return await messages.last().textContent() || "";
  }
  // Fallback: try to get all message content and return the last one
  return "";
}

test.describe("Phase 2: Chat Public Tests", () => {
  
  test("TEST 1: Tapicería Jaén - Known provider booking", async ({ page }) => {
    test.setTimeout(300_000);
    
    await page.goto("/chat");
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/01-chat-layout.png`, fullPage: true });
    
    // Send greeting identifying as Tapicería Jaén
    await sendMessage(page, "Hola buenas, soy José Antonio de Tapicería Jaén");
    await waitForResponse(page);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/01-chat-jaen-hello.png`, fullPage: true });
    
    // Send delivery info
    await sendMessage(page, "Traigo 15 sofás para descargar");
    await waitForResponse(page);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/01-chat-jaen-datos.png`, fullPage: true });
    
    // Request date
    await sendMessage(page, "El martes 3 de marzo me viene bien");
    await waitForResponse(page);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/01-chat-jaen-dispo.png`, fullPage: true });
    
    // Confirm first slot
    await sendMessage(page, "Perfecto, el primer hueco");
    await waitForResponse(page);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/01-chat-jaen-reserva.png`, fullPage: true });
    
    // Verify confirmation
    const pageContent = await page.textContent("body");
    const hasConfirmation = pageContent?.toLowerCase().includes("reservad") || 
                           pageContent?.toLowerCase().includes("confirmad") ||
                           pageContent?.toLowerCase().includes("registrad") ||
                           pageContent?.toLowerCase().includes("cita");
    console.log("Jaén booking confirmed:", hasConfirmation);
  });

  test("TEST 2: Mengualba Agency + Delonghi", async ({ page }) => {
    test.setTimeout(300_000);
    
    await page.goto("/chat");
    await page.waitForTimeout(3000);
    
    await sendMessage(page, "Buenos días, soy Carmen de Mengualba. Traemos una entrega de Delonghi, 45 bultos");
    await waitForResponse(page);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/02-mengualba-hello.png`, fullPage: true });
    
    await sendMessage(page, "Son electrodomésticos, 3 albaranes");
    await waitForResponse(page);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/02-mengualba-datos.png`, fullPage: true });
    
    await sendMessage(page, "Para el miércoles 4 de marzo");
    await waitForResponse(page);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/02-mengualba-fecha.png`, fullPage: true });
    
    await sendMessage(page, "Vale, a las 10");
    await waitForResponse(page);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/02-mengualba-reserva.png`, fullPage: true });
  });

  test("TEST 3: Unknown provider - Transportes García de Málaga", async ({ page }) => {
    test.setTimeout(300_000);
    
    await page.goto("/chat");
    await page.waitForTimeout(3000);
    
    await sendMessage(page, "Hola, somos Transportes García de Málaga, primera vez que venimos");
    await waitForResponse(page);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/03-nuevo-hello.png`, fullPage: true });
    
    await sendMessage(page, "Traemos 30 muebles de cocina");
    await waitForResponse(page);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/03-nuevo-datos.png`, fullPage: true });
    
    await sendMessage(page, "Para el jueves 5 de marzo");
    await waitForResponse(page);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/03-nuevo-fecha.png`, fullPage: true });
    
    await sendMessage(page, "La primera franja");
    await waitForResponse(page);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/03-nuevo-reserva.png`, fullPage: true });
  });

  test("TEST 4: Pedro Ortiz - Full trailer", async ({ page }) => {
    test.setTimeout(300_000);
    
    await page.goto("/chat");
    await page.waitForTimeout(3000);
    
    await sendMessage(page, "Buenas tardes, soy de Pedro Ortiz, venimos con tráiler completo, 180 bultos de tapicería");
    await waitForResponse(page);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/04-pedro-ortiz.png`, fullPage: true });
    
    await sendMessage(page, "Para el viernes 6 de marzo, primera hora");
    await waitForResponse(page);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/04-pedro-ortiz-fecha.png`, fullPage: true });
    
    await sendMessage(page, "Confirmamos");
    await waitForResponse(page);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/04-pedro-ortiz-reserva.png`, fullPage: true });
  });

  test("TEST 5: CODECO - High volume electro", async ({ page }) => {
    test.setTimeout(300_000);
    
    await page.goto("/chat");
    await page.waitForTimeout(3000);
    
    await sendMessage(page, "Hola, soy de CODECO, traemos 200 electrodomésticos variados, 8 albaranes");
    await waitForResponse(page);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/05-codeco.png`, fullPage: true });
    
    await sendMessage(page, "Para el lunes 9 de marzo");
    await waitForResponse(page);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/05-codeco-fecha.png`, fullPage: true });
    
    await sendMessage(page, "La franja de las 10");
    await waitForResponse(page);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/05-codeco-reserva.png`, fullPage: true });
  });
});
