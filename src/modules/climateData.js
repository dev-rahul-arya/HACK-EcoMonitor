/**
 * Climate Data Parser & Analytics Module
 * Parses GlobalTemperatures.csv and provides trend analysis,
 * decadal summaries, anomaly detection, risk indices, and projections.
 */

export async function loadClimateData() {
    const response = await fetch('/data/GlobalTemperatures.csv');
    const text = await response.text();
    return parseCSV(text);
}

function parseCSV(text) {
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',');
    const records = [];

    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',');
        const dt = cols[0]?.trim();
        if (!dt) continue; // skip rows with missing dates

        const row = {
            date: new Date(dt),
            year: parseInt(dt.split('-')[0]),
            month: parseInt(dt.split('-')[1]),
            landAvg: parseFloat(cols[1]) || null,
            landAvgUncertainty: parseFloat(cols[2]) || null,
            landMax: parseFloat(cols[3]) || null,
            landMaxUncertainty: parseFloat(cols[4]) || null,
            landMin: parseFloat(cols[5]) || null,
            landMinUncertainty: parseFloat(cols[6]) || null,
            landOceanAvg: parseFloat(cols[7]) || null,
            landOceanAvgUncertainty: parseFloat(cols[8]) || null,
        };
        if (row.landAvg !== null) records.push(row);
    }
    return records;
}

/** Compute yearly averages from monthly data */
export function computeYearlyAverages(records) {
    const yearMap = {};
    for (const r of records) {
        if (!yearMap[r.year]) {
            yearMap[r.year] = {
                year: r.year,
                landAvgSum: 0, landAvgCount: 0,
                landMaxSum: 0, landMaxCount: 0,
                landMinSum: 0, landMinCount: 0,
                landOceanSum: 0, landOceanCount: 0,
                uncertaintySum: 0, uncertaintyCount: 0,
            };
        }
        const y = yearMap[r.year];
        if (r.landAvg !== null) { y.landAvgSum += r.landAvg; y.landAvgCount++; }
        if (r.landMax !== null) { y.landMaxSum += r.landMax; y.landMaxCount++; }
        if (r.landMin !== null) { y.landMinSum += r.landMin; y.landMinCount++; }
        if (r.landOceanAvg !== null) { y.landOceanSum += r.landOceanAvg; y.landOceanCount++; }
        if (r.landAvgUncertainty !== null) { y.uncertaintySum += r.landAvgUncertainty; y.uncertaintyCount++; }
    }

    return Object.values(yearMap)
        .map(y => ({
            year: y.year,
            landAvg: y.landAvgCount ? +(y.landAvgSum / y.landAvgCount).toFixed(3) : null,
            landMax: y.landMaxCount ? +(y.landMaxSum / y.landMaxCount).toFixed(3) : null,
            landMin: y.landMinCount ? +(y.landMinSum / y.landMinCount).toFixed(3) : null,
            landOceanAvg: y.landOceanCount ? +(y.landOceanSum / y.landOceanCount).toFixed(3) : null,
            uncertainty: y.uncertaintyCount ? +(y.uncertaintySum / y.uncertaintyCount).toFixed(3) : null,
        }))
        .sort((a, b) => a.year - b.year);
}

/** Compute decadal averages for warming analysis */
export function computeDecadalAverages(yearlyData) {
    const decadeMap = {};
    for (const y of yearlyData) {
        const decade = Math.floor(y.year / 10) * 10;
        if (!decadeMap[decade]) {
            decadeMap[decade] = { decade, sums: 0, count: 0, maxTemp: -Infinity, minTemp: Infinity };
        }
        if (y.landAvg !== null) {
            decadeMap[decade].sums += y.landAvg;
            decadeMap[decade].count++;
            decadeMap[decade].maxTemp = Math.max(decadeMap[decade].maxTemp, y.landAvg);
            decadeMap[decade].minTemp = Math.min(decadeMap[decade].minTemp, y.landAvg);
        }
    }

    const decades = Object.values(decadeMap)
        .filter(d => d.count > 0)
        .map(d => ({
            decade: `${d.decade}s`,
            decadeNum: d.decade,
            avg: +(d.sums / d.count).toFixed(3),
            range: +(d.maxTemp - d.minTemp).toFixed(3),
        }))
        .sort((a, b) => a.decadeNum - b.decadeNum);

    // Compute warming relative to first decade
    if (decades.length > 0) {
        const baseline = decades[0].avg;
        for (const d of decades) {
            d.anomaly = +(d.avg - baseline).toFixed(3);
        }
    }
    return decades;
}

/** Detect temperature anomalies (years deviating >1.5 std from mean) */
export function detectAnomalies(yearlyData) {
    const temps = yearlyData.filter(y => y.landAvg !== null).map(y => y.landAvg);
    const mean = temps.reduce((a, b) => a + b, 0) / temps.length;
    const std = Math.sqrt(temps.reduce((s, v) => s + (v - mean) ** 2, 0) / temps.length);
    const threshold = 1.5;

    return yearlyData
        .filter(y => y.landAvg !== null && Math.abs(y.landAvg - mean) > threshold * std)
        .map(y => ({
            year: y.year,
            temp: y.landAvg,
            deviation: +((y.landAvg - mean) / std).toFixed(2),
            type: y.landAvg > mean ? 'warm' : 'cold',
        }));
}

/** Compute a climate risk index (0-100) based on warming rate, variability, max temp */
export function computeRiskIndex(yearlyData, decadal) {
    if (yearlyData.length < 10 || decadal.length < 2) return { score: 0, factors: {} };

    // Factor 1: Overall warming trend (linear regression slope per century)
    const temps = yearlyData.filter(y => y.landAvg !== null);
    const n = temps.length;
    const xMean = temps.reduce((s, y) => s + y.year, 0) / n;
    const yMean = temps.reduce((s, y) => s + y.landAvg, 0) / n;
    let num = 0, den = 0;
    for (const t of temps) {
        num += (t.year - xMean) * (t.landAvg - yMean);
        den += (t.year - xMean) ** 2;
    }
    const slopePerYear = den ? num / den : 0;
    const slopePerCentury = slopePerYear * 100;

    // Factor 2: Temperature variability (std dev of yearly temps)
    const stdDev = Math.sqrt(temps.reduce((s, y) => s + (y.landAvg - yMean) ** 2, 0) / n);

    // Factor 3: Recent warming acceleration (last 3 decades vs first 3 decades)
    const first3 = decadal.slice(0, 3);
    const last3 = decadal.slice(-3);
    const first3Avg = first3.reduce((s, d) => s + d.avg, 0) / first3.length;
    const last3Avg = last3.reduce((s, d) => s + d.avg, 0) / last3.length;
    const acceleration = last3Avg - first3Avg;

    // Normalize each factor to 0-100 and weight them
    const trendScore = Math.min(Math.abs(slopePerCentury) * 30, 40); // max 40 pts
    const variabilityScore = Math.min(stdDev * 5, 30); // max 30 pts
    const accelerationScore = Math.min(Math.max(acceleration, 0) * 15, 30); // max 30 pts

    const score = Math.round(Math.min(trendScore + variabilityScore + accelerationScore, 100));

    return {
        score,
        level: score >= 70 ? 'Critical' : score >= 45 ? 'Elevated' : score >= 20 ? 'Moderate' : 'Low',
        color: score >= 70 ? '#ef4444' : score >= 45 ? '#f59e0b' : score >= 20 ? '#3b82f6' : '#10b981',
        factors: {
            warmingRate: +slopePerCentury.toFixed(4),
            variability: +stdDev.toFixed(3),
            acceleration: +acceleration.toFixed(3),
        },
        trendScore: Math.round(trendScore),
        variabilityScore: Math.round(variabilityScore),
        accelerationScore: Math.round(accelerationScore),
    };
}

/** Simple linear projection into the future */
export function projectTemperatures(yearlyData, yearsAhead = 50) {
    const temps = yearlyData.filter(y => y.landAvg !== null);
    const n = temps.length;
    if (n < 2) return [];

    const xMean = temps.reduce((s, y) => s + y.year, 0) / n;
    const yMean = temps.reduce((s, y) => s + y.landAvg, 0) / n;
    let num = 0, den = 0;
    for (const t of temps) {
        num += (t.year - xMean) * (t.landAvg - yMean);
        den += (t.year - xMean) ** 2;
    }
    const slope = den ? num / den : 0;
    const intercept = yMean - slope * xMean;

    // Compute residuals for uncertainty
    const residuals = temps.map(t => t.landAvg - (slope * t.year + intercept));
    const residualStd = Math.sqrt(residuals.reduce((s, r) => s + r * r, 0) / n);

    const lastYear = temps[temps.length - 1].year;
    const projections = [];
    for (let i = 1; i <= yearsAhead; i++) {
        const yr = lastYear + i;
        const predicted = +(slope * yr + intercept).toFixed(3);
        // Uncertainty grows with distance from data
        const unc = +(residualStd * Math.sqrt(1 + i / n) * 1.96).toFixed(3);
        projections.push({ year: yr, predicted, lower: +(predicted - unc).toFixed(3), upper: +(predicted + unc).toFixed(3) });
    }
    return projections;
}

/** Compute summary statistics */
export function computeStats(yearlyData, decadal) {
    const temps = yearlyData.filter(y => y.landAvg !== null);
    if (!temps.length) return {};

    const allTemps = temps.map(t => t.landAvg);
    const maxEntry = temps.reduce((m, t) => t.landAvg > m.landAvg ? t : m);
    const minEntry = temps.reduce((m, t) => t.landAvg < m.landAvg ? t : m);
    const mean = allTemps.reduce((a, b) => a + b, 0) / allTemps.length;

    const warmestDecade = decadal.length ? decadal.reduce((m, d) => d.avg > m.avg ? d : m) : null;
    const coldestDecade = decadal.length ? decadal.reduce((m, d) => d.avg < m.avg ? d : m) : null;

    const firstDecadeAvg = decadal.length >= 2 ? decadal[0].avg : null;
    const lastDecadeAvg = decadal.length >= 2 ? decadal[decadal.length - 1].avg : null;
    const totalChange = firstDecadeAvg !== null && lastDecadeAvg !== null ? +(lastDecadeAvg - firstDecadeAvg).toFixed(3) : null;

    return {
        totalRecords: temps.length,
        yearRange: `${temps[0].year}–${temps[temps.length - 1].year}`,
        overallMean: +mean.toFixed(3),
        hottest: { year: maxEntry.year, temp: maxEntry.landAvg },
        coldest: { year: minEntry.year, temp: minEntry.landAvg },
        warmestDecade: warmestDecade ? { decade: warmestDecade.decade, avg: warmestDecade.avg } : null,
        coldestDecade: coldestDecade ? { decade: coldestDecade.decade, avg: coldestDecade.avg } : null,
        totalChange,
    };
}
