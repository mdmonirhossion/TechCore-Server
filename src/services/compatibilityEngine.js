export function calculatePerformanceTier(selectedComponents = {}) {
  const cpu = selectedComponents.cpu || {};
  const gpu = selectedComponents.gpu || {};
  const ram = selectedComponents.ram || {};

  let cpuScore = 40;
  let gpuScore = 30;
  let ramScore = 40;

  const cpuName = (cpu.name || cpu.title || '').toLowerCase();
  const gpuName = (gpu.name || gpu.title || '').toLowerCase();
  const ramCapacity = parseInt(ram.specifications?.capacity || ram.name || '8', 10) || 8;

  // CPU Score calculation
  if (cpuName.includes('i9') || cpuName.includes('ryzen 9') || cpuName.includes('7950x') || cpuName.includes('14900k')) {
    cpuScore = 95;
  } else if (cpuName.includes('i7') || cpuName.includes('ryzen 7') || cpuName.includes('7800x3d') || cpuName.includes('14700k')) {
    cpuScore = 85;
  } else if (cpuName.includes('i5') || cpuName.includes('ryzen 5') || cpuName.includes('13400') || cpuName.includes('7600')) {
    cpuScore = 70;
  } else if (cpuName.includes('i3') || cpuName.includes('ryzen 3')) {
    cpuScore = 55;
  }

  // GPU Score calculation
  if (gpuName.includes('4090') || gpuName.includes('4080') || gpuName.includes('7900 xtx')) {
    gpuScore = 98;
  } else if (gpuName.includes('4070') || gpuName.includes('3080') || gpuName.includes('7800 xt')) {
    gpuScore = 88;
  } else if (gpuName.includes('4060') || gpuName.includes('3060') || gpuName.includes('6700 xt') || gpuName.includes('7600')) {
    gpuScore = 72;
  } else if (gpuName.includes('1650') || gpuName.includes('3050') || gpuName.includes('rx 6500')) {
    gpuScore = 55;
  } else if (gpuName) {
    gpuScore = 50;
  } else {
    // Integrated graphics
    gpuScore = 30;
  }

  // RAM Score calculation
  if (ramCapacity >= 32) {
    ramScore = 95;
  } else if (ramCapacity >= 16) {
    ramScore = 80;
  } else if (ramCapacity >= 8) {
    ramScore = 60;
  }

  const gamingScore = Math.round(gpuScore * 0.65 + cpuScore * 0.25 + ramScore * 0.10);
  const editingScore = Math.round(cpuScore * 0.50 + ramScore * 0.30 + gpuScore * 0.20);
  const officeScore = Math.min(99, Math.round(cpuScore * 0.40 + ramScore * 0.40 + 30));

  let tier = 'Entry Level & Daily Computing';
  if (gamingScore >= 88) {
    tier = 'Extreme 4K Gaming & Heavy Workstation';
  } else if (gamingScore >= 75) {
    tier = '1440p High FPS Gaming & Content Creation';
  } else if (gamingScore >= 60) {
    tier = '1080p Esports & Smooth Productivity';
  } else if (gamingScore >= 45) {
    tier = 'Budget Gaming & Home Office';
  }

  return {
    tier,
    gamingScore,
    editingScore,
    officeScore
  };
}

export function evaluatePcBuild(selectedComponents = {}) {
  // selectedComponents is an object like: { cpu: prod, motherboard: prod, ram: prod, gpu: prod, psu: prod, casing: prod, storage: prod, ... }
  const issues = [];
  const validChecks = [];
  let totalTdp = 50; // Base motherboard/fans/drives wattage

  const cpu = selectedComponents.cpu;
  const motherboard = selectedComponents.motherboard;
  const ram = selectedComponents.ram;
  const gpu = selectedComponents.gpu;
  const psu = selectedComponents.psu;
  const casing = selectedComponents.casing;

  // 1. Socket Compatibility
  if (cpu && motherboard) {
    const cpuSocket = cpu.specifications?.socket || cpu.socket;
    const mbSocket = motherboard.specifications?.socket || motherboard.socket;

    if (cpuSocket && mbSocket) {
      if (cpuSocket.toString().toUpperCase() === mbSocket.toString().toUpperCase()) {
        validChecks.push({
          title: 'CPU & Motherboard Socket Compatibility',
          message: `Compatible ✓ Both use ${cpuSocket} socket.`
        });
      } else {
        issues.push({
          type: 'SOCKET_MISMATCH',
          severity: 'error',
          title: 'CPU & Motherboard Incompatible',
          message: `CPU socket (${cpuSocket}) does not match Motherboard socket (${mbSocket}).`
        });
      }
    }
  }

  // 2. RAM Type Compatibility
  if (motherboard && ram) {
    const mbRamType = motherboard.specifications?.ramType || motherboard.ramType;
    const ramType = ram.specifications?.ramType || ram.ramType;

    if (mbRamType && ramType) {
      if (mbRamType.toString().toUpperCase() === ramType.toString().toUpperCase()) {
        validChecks.push({
          title: 'RAM Type Compatibility',
          message: `Compatible ✓ Both support ${ramType}.`
        });
      } else {
        issues.push({
          type: 'RAM_MISMATCH',
          severity: 'error',
          title: 'Motherboard & RAM Incompatible',
          message: `Motherboard requires ${mbRamType} RAM, but selected RAM is ${ramType}.`
        });
      }
    }
  }

  // 3. Motherboard & Casing Form Factor Check
  if (motherboard && casing) {
    const mbForm = (motherboard.specifications?.formFactor || motherboard.formFactor || '').toLowerCase();
    const caseSupport = (casing.specifications?.motherboardSupport || casing.supportedFormFactors || '').toLowerCase();

    if (mbForm && caseSupport) {
      if (caseSupport.includes(mbForm)) {
        validChecks.push({
          title: 'Motherboard & Casing Form Factor',
          message: `Compatible ✓ Casing supports ${mbForm.toUpperCase()} motherboard.`
        });
      } else {
        issues.push({
          type: 'FORM_FACTOR_MISMATCH',
          severity: 'warning',
          title: 'Possible Casing Size Restriction',
          message: `Casing may not support ${mbForm.toUpperCase()} form factor. Supported: ${caseSupport.toUpperCase() || 'Standard ATX'}.`
        });
      }
    }
  }

  // 4. TDP Power Calculation
  if (cpu) {
    const cpuTdp = cpu.specifications?.tdpWatts || cpu.tdpWatts || 105;
    totalTdp += Number(cpuTdp);
  }
  if (gpu) {
    const gpuTdp = gpu.specifications?.powerTdpWatts || gpu.powerTdpWatts || 150;
    totalTdp += Number(gpuTdp);
  }

  const recommendedPsuWattage = Math.max(500, Math.ceil((totalTdp * 1.3) / 50) * 50);

  if (psu) {
    const psuWatts = psu.specifications?.wattage || psu.wattage || 500;
    if (psuWatts < totalTdp) {
      issues.push({
        type: 'PSU_INSUFFICIENT',
        severity: 'warning',
        title: 'PSU Power Output Warning',
        message: `Selected PSU (${psuWatts}W) is lower than system peak load (${totalTdp}W). Recommending at least ${recommendedPsuWattage}W.`
      });
    } else {
      validChecks.push({
        title: 'Power Supply Compatibility',
        message: `Sufficient Power ✓ System uses ~${totalTdp}W, PSU delivers ${psuWatts}W.`
      });
    }
  }

  const performanceTier = calculatePerformanceTier(selectedComponents);

  return {
    isCompatible: issues.filter(i => i.severity === 'error').length === 0,
    issues,
    validChecks,
    totalTdp,
    recommendedPsuWattage,
    performanceTier
  };
}
