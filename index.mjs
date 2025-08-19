import { chromium } from "playwright-core";
import chromiumExec from "@sparticuz/chromium";

const dianAppointmentUrl = 'https://player.dian.gov.co/Player.aspx?recurso=CitasDIAN';
const ntfyTopic = 'https://ntfy.sh/dian_appointment';
const waitTime = 2000;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function handler() {
  const browser = await chromium.launch({
    args: chromiumExec.args,
    executablePath: await chromiumExec.executablePath(),
  });

  const page = await browser.newPage();
  await page.goto(dianAppointmentUrl, { waitUntil: 'networkidle' });

  await waitForDianToLoad(page);

  await checkCityAvailability(page, "medellin");
  await browser.close();

  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Check completed successfully' })
  };
}

async function waitForDianToLoad(page) {
  let attempts = 0;
  const maxAttempts = 30;
  
  while (attempts < maxAttempts) {
    const splash = await page.$('.splash');
    const style = await splash?.getAttribute('style');
    const loading = !style;

    attempts++;
    console.log(`Attempt ${attempts}: Splash style: '${style}'`);

    if (!loading) {
      console.log('DIAN config loaded');
      break;
    }

    console.log('DIAN config still loading...');
    await sleep(waitTime);
  }
  
  if (attempts >= maxAttempts) {
    throw new Error('Timeout waiting for DIAN to load');
  }
}

async function checkCityAvailability(page, city) {
  console.log(`Checking availability for ${city}...`);
  await sleep(waitTime);

  await page.$$eval('[nombre="btnSolicitarCita"]', button => button.at(0)?.click());
  console.log('Solicitud de cita iniciada!');
  await sleep(waitTime);

  await page.$$eval('.btnTipoPersona', button => button.at(0)?.click());
  console.log('Tipo de persona seleccionado!');
  await sleep(waitTime);

  await page.$$eval('.btnTipoAtencion', button => button.at(0)?.click());
  console.log('Tipo de atención seleccionado!');
  await sleep(waitTime);

  await page.$$eval('.btnCategoria', button => button.at(0)?.click());
  console.log('Categoria seleccionada!');
  await sleep(waitTime);

  await page.$$eval('.customSelect', selects => {
    const rutInscriptionProcedureId = 159;
    const indexProcedureSelector = -1;
    const select = selects.at(indexProcedureSelector);

    select.value = rutInscriptionProcedureId;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
  console.log('Procedimiento seleccionado!');
  await sleep(waitTime);

  await page.$$eval('[contenido="botonesPasoUno"] [nombre="btnSiguiente"]', button => button.at(0)?.click());
  console.log('Siguiente paso!');
  await sleep(waitTime);

  const cities = await page.$$eval('.customSelect', selects => {
    const indexCitySelector = 3;
    const select = selects.at(indexCitySelector);

    return Array.from(select.options)
      .map(option => option.textContent.trim())
      .filter(Boolean);
  });

  console.log('Ciudades disponibles obtenidas!');
  
  const cityAvailable = cities.some(c => {
    const sameCityName = c.localeCompare(city, 'es', { sensitivity: 'base' }) === 0;
    return sameCityName;
  });
  
  if (!cityAvailable) return console.log(`No hay citas disponibles en ${city}`);
  
  await fetch(ntfyTopic, {
    method: 'POST',
    body: `¡Citas disponibles en ${city} para la inscripción en RUT!`,
  });
}
