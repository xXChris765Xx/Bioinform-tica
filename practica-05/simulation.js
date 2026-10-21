// Motor didáctico diario para Citrus limon.
// Los umbrales iniciales proceden del reporte técnico del proyecto; las tasas
// y conversiones de biomasa/producción son aproximaciones configurables.

export const GROWTH_MODELS = [
    { id: 'lineal', label: 'Lineal' },
    { id: 'exponencial', label: 'Exponencial' },
    { id: 'logistico', label: 'Logístico (Verhulst)' },
    { id: 'gompertz', label: 'Gompertz' }
];

const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, value));
const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;

export function growthCurve(model, day, { r = 0.0025, K = 1, t0 = 900, initial = 0.02 } = {}) {
    const t = Math.max(0, Number(day) || 0);
    const carrying = Math.max(0.0001, Number(K) || 1);
    const rate = Math.max(0.00001, Number(r) || 0.0025);
    let value;

    switch (model) {
        case 'lineal':
            value = initial + (1 - initial) * t / Math.max(1, t0 * 1.7);
            break;
        case 'exponencial':
            value = initial * Math.exp(rate * t);
            break;
        case 'gompertz':
            value = carrying * Math.exp(-Math.exp(-rate * (t - t0)));
            break;
        case 'logistico':
        default:
            value = carrying / (1 + ((carrying - initial) / initial) * Math.exp(-rate * t));
            break;
    }

    return clamp(value / carrying, 0, 1);
}

function rangeStress(value, min, max) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 50;
    if (number >= min && number <= max) return 0;
    const distance = number < min ? min - number : number - max;
    const scale = Math.max(1, max - min);
    return clamp((distance / scale) * 100);
}

export function calculateStress(environment, nutrients, species) {
    const heat = rangeStress(environment.temperatureC, species.temperatura_min_c, species.temperatura_max_c);
    const humidity = rangeStress(environment.humidityPct, species.humedad_min_pct, species.humedad_max_pct);
    const light = Number(environment.sunHours) >= Number(species.luz_min_horas)
        ? clamp((Number(species.luz_optima_horas) - Number(environment.sunHours)) * 8)
        : clamp((Number(species.luz_min_horas) - Number(environment.sunHours)) * 15);
    const water = clamp((Number(species.hidratacion_min_pct) - Number(environment.soilMoisturePct)) * 2.5);
    const ph = rangeStress(environment.soilPh, species.ph_min, species.ph_max);
    const nutrientValues = ['N', 'P', 'K', 'Fe'].map((key) => clamp((40 - Number(nutrients[key] ?? 70)) * 2.5));
    return {
        water,
        heat,
        light,
        nutrients: clamp(mean(nutrientValues.concat(ph))),
        humidity,
        total: clamp(mean([water, heat, light, mean(nutrientValues), ph]))
    };
}

function potentialFruitCount(ageDays) {
    const years = ageDays / 365;
    if (years < 3) return 0;
    if (years < 4) return 5 + (years - 3) * 10;
    if (years < 5) return 20 + (years - 4) * 30;
    if (years < 6) return 50 + (years - 5) * 30;
    if (years <= 8) return 100 + (years - 6) * 100;
    return 300;
}

function stageFor(ageDays) {
    if (ageDays < 21) return 'Germinación';
    if (ageDays < 183) return 'Plántula';
    if (ageDays < 1095) return 'Juvenil';
    return 'Adulto';
}

function recommendationFor(state, stress) {
    if (state.soilMoisturePct < 30) {
        return { category: 'riego', priority: 'critica', rule: 'hidratacion_menor_30', threshold: 30, observed: state.soilMoisturePct, text: 'Aumentar el riego: la hidratación del suelo bajó del 30 %.' };
    }
    if (state.temperatureC < 0) {
        return { category: 'temperatura', priority: 'critica', rule: 'riesgo_helada', threshold: 0, observed: state.temperatureC, text: 'Proteger el árbol de la helada; por debajo de 0 °C pueden caer flores y frutos.' };
    }
    if (state.humidityPct > 80 && state.temperatureC > 20) {
        return { category: 'general', priority: 'aviso', rule: 'riesgo_hongos', threshold: 80, observed: state.humidityPct, text: 'Vigilar hongos: humedad ambiental mayor al 80 % con temperatura sobre 20 °C favorece enfermedades.' };
    }
    if (state.windKmh > 30) {
        return { category: 'general', priority: 'aviso', rule: 'viento_fuerte', threshold: 30, observed: state.windKmh, text: 'Reducir la exposición al viento; arriba de 30 km/h aumenta el riesgo de caída y daño de ramas.' };
    }
    if (state.temperatureC < 17 || state.temperatureC > 28) {
        return { category: 'temperatura', priority: 'aviso', rule: 'temperatura_fuera_optimo', threshold: null, observed: state.temperatureC, text: 'Revisar el microclima: el rango inicial recomendado es 17–28 °C.' };
    }
    if (stress.nutrients > 20) {
        return { category: 'nutrientes', priority: 'aviso', rule: 'nutrientes_bajos', threshold: 40, observed: Math.min(state.nutrients.N, state.nutrients.P, state.nutrients.K, state.nutrients.Fe), text: 'Revisar N, P, K, hierro y pH; hay indicios de estrés nutricional.' };
    }
    if (state.ageDays >= 1095 && state.fruits > 0 && state.fruitDevelopment >= 1 && state.healthPct > 70 && stress.total < 15) {
        return { category: 'cosecha', priority: 'info', rule: 'adulto_sano', threshold: 1095, observed: state.ageDays, text: 'Árbol adulto y en buen estado: inspeccionar los frutos para decidir la cosecha.' };
    }
    return { category: 'general', priority: 'info', rule: 'condiciones_estables', threshold: null, observed: stress.total, text: 'Mantener las condiciones y seguir observando la evolución.' };
}

export function createInitialState(config = {}) {
    const ageDays = Math.max(0, Number(config.initialAgeDays ?? 0));
    const heightCm = Math.max(0, Number(config.initialHeightCm ?? 12));
    const biomassG = Math.max(1, Number(config.initialBiomassG ?? 25));
    return {
        day: 0,
        ageDays,
        startAgeDays: ageDays,
        heightCm,
        startHeightCm: heightCm,
        biomassG,
        startBiomassG: biomassG,
        healthPct: clamp(Number(config.initialHealthPct ?? 90)),
        soilMoisturePct: clamp(Number(config.initialSoilMoisturePct ?? 70)),
        flowers: Math.max(0, Number(config.initialFlowers ?? 0)),
        fruits: Math.max(0, Number(config.initialFruits ?? 0)),
        fruitDevelopment: clamp(Number(config.initialFruitDevelopment ?? 0), 0, 1),
        fruitPotential: Math.max(0, Number(config.initialFruitPotential ?? 0)),
        leaves: 8,
        branches: 3,
        consumedWaterL: 0,
        nutrients: {
            N: clamp(Number(config.nutrients?.N ?? 70)),
            P: clamp(Number(config.nutrients?.P ?? 70)),
            K: clamp(Number(config.nutrients?.K ?? 70)),
            Fe: clamp(Number(config.nutrients?.Fe ?? 70))
        }
    };
}

export function stepSimulation(state, environment, species, options = {}) {
    const next = { ...state, day: state.day + 1, ageDays: state.ageDays + 1, nutrients: { ...state.nutrients } };
    const weeklyLitres = Math.max(0, Number(environment.irrigationLWeek ?? 80));
    const retentionLitres = Math.max(1, Number(options.retentionLitres ?? 1000));
    const temperature = Number(environment.temperatureC ?? 25);
    const stageFactor = next.ageDays < 183 ? 0.75 : 1;
    const evapotranspiration = (1 + Math.max(0, temperature - 25) * 0.1) * stageFactor;
    const waterAdded = (weeklyLitres / 7 / retentionLitres) * 100;
    next.soilMoisturePct = clamp(state.soilMoisturePct - evapotranspiration + waterAdded);
    next.consumedWaterL += weeklyLitres / 7;

    for (const key of ['N', 'P', 'K', 'Fe']) {
        next.nutrients[key] = clamp(state.nutrients[key] - 0.03 + Number(environment.fertilizer?.[key] ?? 0) / 7);
    }

    const currentEnvironment = {
        ...environment,
        temperatureC: temperature,
        soilMoisturePct: next.soilMoisturePct
    };
    const stress = calculateStress(currentEnvironment, next.nutrients, species);
    const co2Factor = clamp(Number(environment.co2Ppm ?? 420) / 420, 0.75, 1.12);
    const stressFactor = clamp((1 - stress.total / 130) * co2Factor, 0.15, 1.08);
    const r = Number(options.r ?? species.r ?? 0.0025);
    const K = Number(options.K ?? species.capacidad_carga ?? 1);
    const t0 = Number(options.t0 ?? species.dias_madurez ?? 1095);
    const curve = growthCurve(options.model ?? 'logistico', next.ageDays, { r, K, t0, initial: 0.02 });
    const priorCurve = growthCurve(options.model ?? 'logistico', state.ageDays, { r, K, t0, initial: 0.02 });

    const initialCurve = growthCurve(options.model ?? 'logistico', state.startAgeDays, { r, K, t0, initial: 0.02 });
    const priorTrajectory = clamp((priorCurve - initialCurve) / Math.max(0.0001, 1 - initialCurve), 0, 1);
    const currentTrajectory = clamp((curve - initialCurve) / Math.max(0.0001, 1 - initialCurve), 0, 1);
    const trajectoryDelta = Math.max(0, currentTrajectory - priorTrajectory);
    const maxHeight = Number(options.maxHeightCm ?? 400);
    const maxBiomass = Number(options.maxBiomassG ?? 80000);
    next.heightCm = Math.min(maxHeight, state.heightCm + ((maxHeight - state.startHeightCm) * trajectoryDelta * stressFactor));
    next.biomassG = Math.min(maxBiomass, state.biomassG + ((maxBiomass - state.startBiomassG) * trajectoryDelta * stressFactor));
    next.leaves = Math.max(2, Math.round(8 + (next.heightCm / maxHeight) * 220 * stressFactor));
    next.branches = Math.max(1, Math.round(3 + (next.heightCm / maxHeight) * 36 * stressFactor));

    const potential = potentialFruitCount(next.ageDays);
    const reproductiveFactor = clamp(1 - (stress.total / 150), 0, 1);
    const windFactor = Number(environment.windKmh ?? 0) > 30 ? 0.3 : 1;
    const temperatureFactor = temperature < 17 || temperature > 28 ? 0.5 : 1;
    const targetFruits = Math.round(potential * reproductiveFactor * windFactor * temperatureFactor);
    const waterYieldFactor = next.soilMoisturePct < Number(species.hidratacion_min_pct) ? 0.5 : 1;
    const daysSinceMaturity = Math.min(next.day, Math.max(0, next.ageDays - Number(species.dias_madurez ?? 1095)));
    next.fruitDevelopment = clamp((daysSinceMaturity - 28) / 120, 0, 1);
    next.fruitPotential = targetFruits;
    const bloomProgress = clamp(daysSinceMaturity / 18, 0, 1);
    const bloomWindow = Math.sin(Math.PI * bloomProgress);
    next.flowers = stageFor(next.ageDays) === 'Adulto' && temperatureFactor === 1
        ? Math.round(targetFruits * 0.18 * bloomWindow)
        : 0;
    next.fruits = Math.round(targetFruits * next.fruitDevelopment * waterYieldFactor);
    next.healthPct = clamp(state.healthPct - Math.max(0, stress.total - 15) * 0.015 + (stress.total < 10 ? 0.03 : 0));
    next.stage = stageFor(next.ageDays);
    next.stress = stress;
    next.growthPct = clamp(currentTrajectory * 100);
    next.icr = state.biomassG > 0 ? ((next.biomassG - state.biomassG) / state.biomassG) * 100 : 0;
    next.recommendation = recommendationFor({ ...currentEnvironment, ...next }, stress);
    return next;
}

export function runScenario({ species, environment, model = 'logistico', days = 365, initial = {}, parameters = {} }) {
    let state = createInitialState(initial);
    const measurements = [{ ...state, stage: stageFor(state.ageDays), growthPct: 0, stress: { water: 0, heat: 0, light: 0, nutrients: 0, humidity: 0, total: 0 } }];
    const decisions = [];
    for (let i = 0; i < days; i += 1) {
        state = stepSimulation(state, environment, species, { ...parameters, model });
        if (state.day % 7 === 0 || state.day === days) measurements.push({ ...state });
        if (state.day === 1 || state.day % 7 === 0) decisions.push({ day: state.day, ...state.recommendation });
    }
    return { state, measurements, decisions, model, days };
}
