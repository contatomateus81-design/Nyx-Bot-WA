const DDD_CITIES = {
  '11': ['São Paulo', 'SP'], '12': ['São José dos Campos', 'SP'],
  '13': ['Santos', 'SP'], '14': ['Bauru', 'SP'], '15': ['Sorocaba', 'SP'],
  '16': ['Ribeirão Preto', 'SP'], '17': ['São José do Rio Preto', 'SP'],
  '18': ['Presidente Prudente', 'SP'], '19': ['Campinas', 'SP'],
  '21': ['Rio de Janeiro', 'RJ'], '22': ['Campos dos Goytacazes', 'RJ'],
  '24': ['Volta Redonda', 'RJ'], '27': ['Vitória', 'ES'],
  '28': ['Cachoeiro de Itapemirim', 'ES'], '31': ['Belo Horizonte', 'MG'],
  '32': ['Juiz de Fora', 'MG'], '33': ['Governador Valadares', 'MG'],
  '34': ['Uberlândia', 'MG'], '35': ['Poços de Caldas', 'MG'],
  '37': ['Divinópolis', 'MG'], '38': ['Montes Claros', 'MG'],
  '41': ['Curitiba', 'PR'], '42': ['Ponta Grossa', 'PR'], '43': ['Londrina', 'PR'],
  '44': ['Maringá', 'PR'], '45': ['Foz do Iguaçu', 'PR'],
  '46': ['Francisco Beltrão', 'PR'], '47': ['Joinville', 'SC'],
  '48': ['Florianópolis', 'SC'], '49': ['Chapecó', 'SC'],
  '51': ['Porto Alegre', 'RS'], '53': ['Pelotas', 'RS'],
  '54': ['Caxias do Sul', 'RS'], '55': ['Santa Maria', 'RS'],
  '61': ['Brasília', 'DF'], '62': ['Goiânia', 'GO'], '63': ['Palmas', 'TO'],
  '64': ['Rio Verde', 'GO'], '65': ['Cuiabá', 'MT'], '66': ['Rondonópolis', 'MT'],
  '67': ['Campo Grande', 'MS'], '68': ['Rio Branco', 'AC'], '69': ['Porto Velho', 'RO'],
  '71': ['Salvador', 'BA'], '73': ['Ilhéus', 'BA'], '74': ['Juazeiro', 'BA'],
  '75': ['Feira de Santana', 'BA'], '77': ['Barreiras', 'BA'], '79': ['Aracaju', 'SE'],
  '81': ['Recife', 'PE'], '82': ['Maceió', 'AL'], '83': ['João Pessoa', 'PB'],
  '84': ['Natal', 'RN'], '85': ['Fortaleza', 'CE'], '86': ['Teresina', 'PI'],
  '87': ['Petrolina', 'PE'], '88': ['Juazeiro do Norte', 'CE'], '89': ['Picos', 'PI'],
  '91': ['Belém', 'PA'], '92': ['Manaus', 'AM'], '93': ['Santarém', 'PA'],
  '94': ['Marabá', 'PA'], '95': ['Boa Vista', 'RR'], '96': ['Macapá', 'AP'],
  '97': ['Coari', 'AM'], '98': ['São Luís', 'MA'], '99': ['Imperatriz', 'MA'],
};

const WEATHER_TERMS = /\b(?:clima|previs[aã]o(?: do tempo)?|como (?:está|esta) o tempo|temperatura|vai chover|chover|chuva|chovendo|umidade do ar|sensa[cç][aã]o t[eé]rmica)\b/i;
const CITY_PATTERN = /\b(?:em|para|na cidade de|no munic[ií]pio de)\s+([\p{L}][\p{L}'’.-]*(?:\s+(?:de|do|da|dos|das|e)\s+[\p{L}][\p{L}'’.-]*|\s+[\p{L}][\p{L}'’.-]*){0,3})/iu;
const CORRECTION_PATTERN = /\b(?:estou|t[oô]|fico|moro)\s+em\s+([\p{L}][\p{L}'’.-]*(?:\s+(?:de|do|da|dos|das|e)\s+[\p{L}][\p{L}'’.-]*|\s+[\p{L}][\p{L}'’.-]*){0,3})/iu;
const TRAILING_CONTEXT = /\s+(?:hoje|amanh[aã]|agora|essa semana|nesta semana|no fim de semana|nos pr[oó]ximos dias).*$/iu;

export function getDefaultCityForPhone(phoneNumber) {
  const digits = String(phoneNumber ?? '').replace(/\D/g, '');
  const ddd = digits.startsWith('55') && digits.length >= 12
    ? digits.slice(2, 4)
    : digits.length >= 10 ? digits.slice(0, 2) : '';
  const entry = DDD_CITIES[ddd];
  return entry ? { city: entry[0], state: entry[1], ddd } : null;
}

function cleanCity(value) {
  return String(value ?? '').replace(TRAILING_CONTEXT, '').trim().replace(/[?!.,;:]+$/g, '');
}

export function extractWeatherCity(prompt) {
  const match = String(prompt ?? '').match(CITY_PATTERN);
  return match ? cleanCity(match[1]) : null;
}

export function extractLocationCorrection(prompt) {
  const match = String(prompt ?? '').match(CORRECTION_PATTERN);
  return match ? cleanCity(match[1]) : null;
}

export function isWeatherQuestion(prompt) {
  return WEATHER_TERMS.test(String(prompt ?? ''));
}

function describeWeatherCode(code) {
  const descriptions = {
    0: 'céu limpo', 1: 'predominantemente limpo', 2: 'parcialmente nublado',
    3: 'nublado', 45: 'neblina', 48: 'neblina com geada',
    51: 'garoa fraca', 53: 'garoa moderada', 55: 'garoa intensa',
    56: 'garoa congelante fraca', 57: 'garoa congelante intensa',
    61: 'chuva fraca', 63: 'chuva moderada', 65: 'chuva forte',
    66: 'chuva congelante fraca', 67: 'chuva congelante forte',
    71: 'neve fraca', 73: 'neve moderada', 75: 'neve forte',
    77: 'grãos de neve', 80: 'pancadas de chuva fracas',
    81: 'pancadas de chuva moderadas', 82: 'pancadas de chuva fortes',
    85: 'pancadas de neve fracas', 86: 'pancadas de neve fortes',
    95: 'trovoadas', 96: 'trovoadas com granizo fraco',
    99: 'trovoadas com granizo forte',
  };
  return descriptions[code] ?? 'condição não especificada';
}

async function fetchJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error(`Open-Meteo respondeu HTTP ${response.status}`);
  return response.json();
}

async function geocodeCity(city) {
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
  url.search = new URLSearchParams({
    name: city, count: '5', language: 'pt', format: 'json', countryCode: 'BR',
  });
  const data = await fetchJson(url);
  const results = data.results ?? [];
  if (!results.length) return null;
  const result = results.find(item => item.country_code === 'BR') ?? results[0];
  return {
    name: result.name,
    admin1: result.admin1,
    latitude: result.latitude,
    longitude: result.longitude,
  };
}

export async function getWeatherReport(city) {
  const place = await geocodeCity(city);
  if (!place) return null;

  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.search = new URLSearchParams({
    latitude: String(place.latitude),
    longitude: String(place.longitude),
    current: 'temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum',
    forecast_days: '2',
    timezone: 'auto',
    temperature_unit: 'celsius',
    wind_speed_unit: 'kmh',
  });
  const data = await fetchJson(url);
  const current = data.current;
  const daily = data.daily;
  if (!current || !daily?.time?.length) throw new Error('A previsão retornou dados incompletos.');

  const tomorrow = daily.time[1] ? {
    date: daily.time[1],
    description: describeWeatherCode(daily.weather_code?.[1]),
    min: daily.temperature_2m_min?.[1],
    max: daily.temperature_2m_max?.[1],
    rainProbability: daily.precipitation_probability_max?.[1],
    rainTotal: daily.precipitation_sum?.[1],
  } : null;

  return {
    location: [place.name, place.admin1].filter(Boolean).join(' - '),
    current: {
      temperature: current.temperature_2m,
      feelsLike: current.apparent_temperature,
      humidity: current.relative_humidity_2m,
      precipitation: current.precipitation,
      wind: current.wind_speed_10m,
      description: describeWeatherCode(current.weather_code),
    },
    tomorrow,
    source: 'Open-Meteo',
  };
}

export function formatWeatherContext(report) {
  const c = report.current;
  const lines = [
    `Local consultado: ${report.location}`,
    `Agora: ${c.description}; temperatura ${c.temperature} °C; sensação térmica ${c.feelsLike} °C; umidade ${c.humidity}%; precipitação atual ${c.precipitation} mm; vento ${c.wind} km/h.`,
  ];
  if (report.tomorrow) {
    const t = report.tomorrow;
    lines.push(`Amanhã (${t.date}): ${t.description}; mínima ${t.min} °C; máxima ${t.max} °C; probabilidade máxima de precipitação ${t.rainProbability ?? 'indisponível'}%; precipitação prevista ${t.rainTotal ?? 'indisponível'} mm.`);
  }
  lines.push('Fonte: Open-Meteo. Informe estes dados sem inventar valores. O local é uma estimativa inicial baseada no DDD ou na última cidade escolhida; se a pessoa corrigir a cidade, use a nova cidade nas próximas consultas.');
  return lines.join('\n');
}
