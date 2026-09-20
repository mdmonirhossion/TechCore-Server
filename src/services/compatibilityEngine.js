export function evaluatePcBuild(selectedComponents) {
  // selectedComponents is an object like: { cpu: prod, motherboard: prod, ram: prod, gpu: prod, psu: prod, ... }
  const issues = [];
  const validChecks = [];
  let totalTdp = 50; // Base motherboard/fans/drives wattage

  const cpu = selectedComponents.cpu;
  const motherboard = selectedComponents.motherboard;
  const ram = selectedComponents.ram;
  const gpu = selectedComponents.gpu;
  const psu = selectedComponents.psu;

  // 1. Socket Compatibility
  if (cpu && motherboard) {
    const cpuSocket = cpu.specifications?.socket;
    const mbSocket = motherboard.specifications?.socket;

    if (cpuSocket && mbSocket) {
      if (cpuSocket.toUpperCase() === mbSocket.toUpperCase()) {
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
    const mbRamType = motherboard.specifications?.ramType;
    const ramType = ram.specifications?.ramType;

    if (mbRamType && ramType) {
      if (mbRamType.toUpperCase() === ramType.toUpperCase()) {
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

  // 3. TDP Power Calculation
  if (cpu) {
    const cpuTdp = cpu.specifications?.tdpWatts || 105;
    totalTdp += Number(cpuTdp);
  }
  if (gpu) {
    const gpuTdp = gpu.specifications?.powerTdpWatts || 150;
    totalTdp += Number(gpuTdp);
  }

  const recommendedPsuWattage = Math.max(500, Math.ceil((totalTdp * 1.3) / 50) * 50);

  if (psu) {
    const psuWatts = psu.specifications?.wattage || 500;
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

  return {
    isCompatible: issues.filter(i => i.severity === 'error').length === 0,
    issues,
    validChecks,
    totalTdp,
    recommendedPsuWattage
  };
}
