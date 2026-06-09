const STORAGE_KEY = "boat-fishing-seat-selector-settings";
const RESULT_KEY = "boat-fishing-seat-selector-result";
let loadingTimerId = null;

function getElement(id) {
  return document.getElementById(id);
}

function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  } catch {
    return null;
  }
}

function saveSettings(settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

function resetLoadingOverlayState() {
  const overlay = getElement("loadingOverlay");

  if (overlay) {
    overlay.hidden = true;
  }

  if (loadingTimerId !== null) {
    window.clearTimeout(loadingTimerId);
    loadingTimerId = null;
  }
}

function splitTeamLine(line) {
  return line.split(",").map((item) => item.trim()).filter(Boolean);
}

function expandShorthandTeam(line) {
  const trimmed = line.trim();
  const match = trimmed.match(/^(.*?)(?:\s*)(\d+)$/);

  if (!match) {
    return splitTeamLine(trimmed);
  }

  const baseName = match[1].trim();
  const memberCount = Number.parseInt(match[2], 10);

  if (!baseName || !Number.isInteger(memberCount) || memberCount < 2) {
    return splitTeamLine(trimmed);
  }

  return Array.from({ length: memberCount }, (_, index) => (
    index === 0 ? baseName : `${baseName} ${index + 1}`
  ));
}

function parseTeams(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(expandShorthandTeam)
    .filter((members) => members.length > 0);
}

function parseCombinedTeams(text) {
  const groupTeams = [];

  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const membersText = line.replace(/^(?:단체|가족)\s*[:=]\s*/u, "");
      const members = expandShorthandTeam(membersText).filter(Boolean);

      if (members.length === 0) {
        return;
      }

      groupTeams.push(members);
    });

  return { groupTeams, familyTeams: [] };
}

function parseSoloMembers(text) {
  return text.split(/[\r\n,]+/).map((item) => item.trim()).filter(Boolean);
}

function parseSeparatedSeats(text, totalSeats) {
  const seatSet = new Set();

  text
    .split(/[\r\n,]+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const match = line.match(/^(\d+)\s*(?:-|~)\s*(\d+)$/);

      if (match) {
        const first = Number.parseInt(match[1], 10);
        const second = Number.parseInt(match[2], 10);

        if (Number.isInteger(first) && first >= 1 && first <= totalSeats) {
          seatSet.add(first);
        }

        if (Number.isInteger(second) && second >= 1 && second <= totalSeats) {
          seatSet.add(second);
        }

        return;
      }

      const singleSeat = Number.parseInt(line, 10);
      if (Number.isInteger(singleSeat) && singleSeat >= 1 && singleSeat <= totalSeats) {
        seatSet.add(singleSeat);
      }
    });

  return [...seatSet].sort((left, right) => left - right);
}

function sanitizeSeparatedSeatsInput(text, totalSeats) {
  const sanitizedParts = [];
  let changed = false;
  const numericPattern = /\d+/g;
  let lastIndex = 0;

  for (const match of text.matchAll(numericPattern)) {
    sanitizedParts.push(text.slice(lastIndex, match.index));

    const seatNumber = Number.parseInt(match[0], 10);
    if (Number.isInteger(seatNumber) && seatNumber >= 1 && seatNumber <= totalSeats) {
      sanitizedParts.push(match[0]);
    } else {
      changed = true;
    }

    lastIndex = match.index + match[0].length;
  }

  sanitizedParts.push(text.slice(lastIndex));

  return {
    text: sanitizedParts.join(""),
    changed
  };
}

function getRandomInt(maxExclusive) {
  if (maxExclusive <= 1) {
    return 0;
  }

  const cryptoObject = globalThis.crypto;
  if (cryptoObject && typeof cryptoObject.getRandomValues === "function") {
    const uint32 = new Uint32Array(1);
    const limit = Math.floor(0x100000000 / maxExclusive) * maxExclusive;

    while (true) {
      cryptoObject.getRandomValues(uint32);
      if (uint32[0] < limit) {
        return uint32[0] % maxExclusive;
      }
    }
  }

  return Math.floor(Math.random() * maxExclusive);
}

function shuffle(array) {
  const result = [...array];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = getRandomInt(index + 1);
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function orderBlocksBySize(blocks) {
  const groupedBySize = new Map();

  blocks.forEach((block) => {
    const bucket = groupedBySize.get(block.size) ?? [];
    bucket.push(block);
    groupedBySize.set(block.size, bucket);
  });

  return [...groupedBySize.entries()]
    .sort((left, right) => right[0] - left[0])
    .flatMap(([, bucket]) => shuffle(bucket));
}

const GROUP_SEAT_COLOR_PALETTE = [
  { bg: "hsla(210, 88%, 56%, 0.14)", number: "hsl(210, 94%, 76%)" },
  { bg: "hsla(6, 88%, 58%, 0.14)", number: "hsl(6, 94%, 76%)" },
  { bg: "hsla(160, 88%, 56%, 0.14)", number: "hsl(160, 94%, 74%)" },
  { bg: "hsla(276, 88%, 60%, 0.14)", number: "hsl(276, 94%, 78%)" },
  { bg: "hsla(338, 88%, 60%, 0.14)", number: "hsl(338, 94%, 78%)" },
  { bg: "hsla(186, 88%, 58%, 0.14)", number: "hsl(186, 94%, 76%)" },
  { bg: "hsla(244, 88%, 60%, 0.14)", number: "hsl(244, 94%, 78%)" },
  { bg: "hsla(124, 88%, 58%, 0.14)", number: "hsl(124, 94%, 76%)" }
];

function getBlockSeatColor(blockId) {
  return GROUP_SEAT_COLOR_PALETTE[blockId % GROUP_SEAT_COLOR_PALETTE.length].bg;
}

function getBlockSeatNumberColor(blockId) {
  return GROUP_SEAT_COLOR_PALETTE[blockId % GROUP_SEAT_COLOR_PALETTE.length].number;
}

function getSoloSeatNumberColor() {
  return "hsl(48, 92%, 74%)";
}

function getSoloSeatColor() {
  return "hsla(48, 85%, 62%, 0.14)";
}

function formatSeatRange(seatNumbers) {
  if (seatNumbers.length <= 1) {
    return `${seatNumbers[0]}번`;
  }

  return `${seatNumbers[0]}번 ~ ${seatNumbers[seatNumbers.length - 1]}번`;
}

function formatSeatCellName(label) {
  if (label.length <= 4) {
    return label;
  }

  return `${label.slice(0, 4)}<br>${label.slice(4)}`;
}

function formatSeatNumberGroups(seatNumbers) {
  if (seatNumbers.length === 0) {
    return "";
  }

  const sortedSeatNumbers = [...new Set(seatNumbers)].sort((left, right) => left - right);
  const groups = [];
  let groupStart = sortedSeatNumbers[0];
  let previousSeatNumber = sortedSeatNumbers[0];

  for (let index = 1; index < sortedSeatNumbers.length; index += 1) {
    const seatNumber = sortedSeatNumbers[index];

    if (seatNumber === previousSeatNumber + 1) {
      previousSeatNumber = seatNumber;
      continue;
    }

    groups.push(groupStart === previousSeatNumber ? `${groupStart}` : `${groupStart}-${previousSeatNumber}`);
    groupStart = seatNumber;
    previousSeatNumber = seatNumber;
  }

  groups.push(groupStart === previousSeatNumber ? `${groupStart}` : `${groupStart}-${previousSeatNumber}`);
  return groups.join(", ");
}

function formatPairedSeatGroups(seatNumbers) {
  if (seatNumbers.length === 0) {
    return "";
  }

  const sortedSeatNumbers = [...new Set(seatNumbers)].sort((left, right) => left - right);
  const groups = [];
  let left = 0;
  let right = sortedSeatNumbers.length - 1;

  while (left < right) {
    groups.push(`${sortedSeatNumbers[left]}-${sortedSeatNumbers[right]}`);
    left += 1;
    right -= 1;
  }

  if (left === right) {
    groups.push(`${sortedSeatNumbers[left]}`);
  }

  return groups.join(", ");
}

function buildEllipseArcTable(horizontalRadius, verticalRadius, samples = 720) {
  const points = [];
  let totalLength = 0;

  for (let sample = 0; sample <= samples; sample += 1) {
    const radians = (sample / samples) * Math.PI * 2;
    const point = {
      x: horizontalRadius * Math.cos(radians),
      y: verticalRadius * Math.sin(radians)
    };

    if (points.length > 0) {
      const previous = points[points.length - 1];
      totalLength += Math.hypot(point.x - previous.x, point.y - previous.y);
    }

    points.push({
      radians,
      x: point.x,
      y: point.y,
      length: totalLength
    });
  }

  return { points, totalLength };
}

function sampleEllipseAtLength(arcTable, targetLength) {
  const { points, totalLength } = arcTable;

  if (points.length === 0) {
    return { x: 0, y: 0, radians: 0 };
  }

  const normalizedTarget = ((targetLength % totalLength) + totalLength) % totalLength;
  let low = 0;
  let high = points.length - 1;

  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (points[mid].length < normalizedTarget) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  const current = points[low];
  const previous = points[Math.max(0, low - 1)];
  const segmentLength = current.length - previous.length || 1;
  const ratio = Math.max(0, Math.min(1, (normalizedTarget - previous.length) / segmentLength));

  return {
    radians: previous.radians + (current.radians - previous.radians) * ratio,
    x: previous.x + (current.x - previous.x) * ratio,
    y: previous.y + (current.y - previous.y) * ratio
  };
}

function distortSeatPoint(point) {
  const topBottomInfluence = Math.pow(Math.abs(Math.sin(point.radians)), 1.1);
  const sideInfluence = Math.pow(Math.abs(Math.cos(point.radians)), 1.2);
  const xScale = 1 + (0.43 * topBottomInfluence) + (0.05 * sideInfluence);
  const yScale = 1 + (0.23 * topBottomInfluence) + (0.11 * sideInfluence);
  const sideScale = 1 + (0.02 * sideInfluence);

  return {
    angle: (point.radians * 180) / Math.PI,
    radians: point.radians,
    x: 50 + point.x * xScale * sideScale,
    y: 50 + point.y * yScale
  };
}

function alignSeatGroupX(points, seatNumbers) {
  const averageX = seatNumbers.reduce((sum, seatNumber) => sum + points[seatNumber - 1].x, 0) / seatNumbers.length;

  seatNumbers.forEach((seatNumber) => {
    points[seatNumber - 1] = {
      ...points[seatNumber - 1],
      x: averageX
    };
  });
}

function smoothSeatPositionsX(points, strength = 0.18) {
  const smoothedPoints = points.map((point, index) => {
    const previous = points[(index - 1 + points.length) % points.length];
    const next = points[(index + 1) % points.length];
    const neighborAverageX = (previous.x + next.x) / 2;

    return {
      ...point,
      x: point.x * (1 - strength) + neighborAverageX * strength
    };
  });

  return smoothedPoints;
}

function keepSeatsOutsideCenter(points, minimumDistance = 29.5) {
  return points.map((point) => {
    const offsetX = point.x - 50;
    const offsetY = point.y - 50;
    const distanceFromCenter = Math.hypot(offsetX, offsetY);

    if (distanceFromCenter >= minimumDistance || distanceFromCenter === 0) {
      return point;
    }

    const scale = minimumDistance / distanceFromCenter;

    return {
      ...point,
      x: 50 + (offsetX * scale),
      y: 50 + (offsetY * scale)
    };
  });
}

function keepSeatsClearOfCore(points, totalSeats) {
  const minimumDistance = totalSeats <= 8 ? 35 : totalSeats <= 14 ? 34 : totalSeats <= 20 ? 32 : totalSeats <= 22 ? 31 : 30;
  return keepSeatsOutsideCenter(points, minimumDistance);
}

function getGuideRings(totalSeats) {
  return totalSeats <= 8
    ? [20, 28, 35, 43]
    : totalSeats <= 14
      ? [21, 29, 36, 43]
      : totalSeats <= 20
        ? [22, 30, 37, 43]
        : [22, 31, 38, 43];
}

function getOuterGuideRingRadius(totalSeats) {
  const guideRings = getGuideRings(totalSeats);
  return guideRings[guideRings.length - 1];
}

function getSeatPlacementRadius(totalSeats) {
  return getOuterGuideRingRadius(totalSeats) * 0.95;
}

function snapSeatsToGuideRings(points, totalSeats) {
  const seatPlacementRadius = getSeatPlacementRadius(totalSeats);

  return points.map((point) => {
    const offsetX = point.x - 50;
    const offsetY = point.y - 50;
    const distanceFromCenter = Math.hypot(offsetX, offsetY);

    if (distanceFromCenter === 0) {
      return point;
    }

    const scale = seatPlacementRadius / distanceFromCenter;

    return {
      ...point,
      x: 50 + (offsetX * scale),
      y: 50 + (offsetY * scale)
    };
  });
}

function alignSeatXToNeighborAverage(points, seatNumber, strength = 0.25) {
  const index = seatNumber - 1;
  const previous = points[index - 1];
  const next = points[index + 1];

  if (!previous || !next) {
    return;
  }

  points[index] = {
    ...points[index],
    x: (points[index].x * (1 - strength)) + (((previous.x + next.x) / 2) * strength)
  };
}

function findArcLengthAtRadians(arcTable, targetRadians) {
  const normalizedTarget = ((targetRadians % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  let bestPoint = arcTable.points[0];
  let smallestDistance = Number.POSITIVE_INFINITY;

  arcTable.points.forEach((point) => {
    const distance = Math.min(
      Math.abs(point.radians - normalizedTarget),
      (Math.PI * 2) - Math.abs(point.radians - normalizedTarget)
    );

    if (distance < smallestDistance) {
      smallestDistance = distance;
      bestPoint = point;
    }
  });

  return bestPoint.length;
}

function buildSeatPositions(totalSeats) {
  const seatPlacementRadius = getSeatPlacementRadius(totalSeats);
  const horizontalRadius = seatPlacementRadius * 0.94;
  const verticalRadius = seatPlacementRadius * 1.09;
  const arcTable = buildEllipseArcTable(horizontalRadius, verticalRadius);
  const seatSpacing = totalSeats > 0 ? arcTable.totalLength / totalSeats : 0;
  const startLength = findArcLengthAtRadians(arcTable, -Math.PI / 2) + (seatSpacing / 2);

  return Array.from({ length: totalSeats }, (_, index) => {
    const point = sampleEllipseAtLength(arcTable, startLength + (index * seatSpacing));

    return {
      angle: (point.radians * 180) / Math.PI,
      radians: point.radians,
      x: 50 + point.x,
      y: 50 + point.y
    };
  });
}

function measureMinimumAdjacentGap(points) {
  if (points.length <= 1) {
    return Number.POSITIVE_INFINITY;
  }

  let minimumGap = Number.POSITIVE_INFINITY;

  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    const gap = Math.hypot(next.x - current.x, next.y - current.y);

    if (gap < minimumGap) {
      minimumGap = gap;
    }
  }

  return minimumGap;
}

function getSeatLayoutRadii(totalSeats) {
  if (totalSeats <= 8) {
    return {
      horizontalRadius: 16,
      verticalRadius: 25
    };
  }

  if (totalSeats <= 14) {
    return {
      horizontalRadius: 18,
      verticalRadius: 29
    };
  }

  if (totalSeats <= 20) {
    return {
      horizontalRadius: 20,
      verticalRadius: 31
    };
  }

  if (totalSeats <= 22) {
    return {
      horizontalRadius: 36,
      verticalRadius: 50
    };
  }

  if (totalSeats <= 28) {
    return {
      horizontalRadius: 22,
      verticalRadius: 36
    };
  }

  return {
    horizontalRadius: 24,
    verticalRadius: 37
  };
}

const seatLayoutCache = new Map();

function calculateSeatPosition(index, totalSeats) {
  if (totalSeats <= 1) {
    return { x: 50, y: 50, angle: -90 };
  }

  const point = buildSeatPositions(totalSeats)[index];

  return {
    angle: point.angle,
    x: point.x,
    y: point.y
  };
}

function validateSettings(settings) {
  if (!Number.isInteger(settings.totalSeats) || settings.totalSeats < 5 || settings.totalSeats > 22) {
    return "전체 좌석수는 5 이상 22 이하여야 합니다.";
  }

  const groupPeople = settings.groupTeams.reduce((sum, team) => sum + team.length, 0)
    + settings.familyTeams.reduce((sum, team) => sum + team.length, 0);
  const totalPeople = groupPeople + settings.soloMembers.length;

  if (totalPeople > settings.totalSeats) {
    return "전체 좌석수는 단체, 가족, 솔로 인원보다 크거나 같아야 합니다.";
  }

  return "";
}

function buildSeatSegments(totalSeats, separatedSeats) {
  const separatorSet = new Set(separatedSeats);
  const segments = [];
  let currentSegment = [];

  for (let seatNumber = 1; seatNumber <= totalSeats; seatNumber += 1) {
    if (separatorSet.has(seatNumber)) {
      if (currentSegment.length > 0) {
        segments.push(currentSegment);
        currentSegment = [];
      }
      continue;
    }

    currentSegment.push(seatNumber);
  }

  if (currentSegment.length > 0) {
    segments.push(currentSegment);
  }

  return segments;
}

function buildBlocks(settings) {
  const blocks = [];

  settings.groupTeams.forEach((members, index) => {
    blocks.push({ kind: "group", title: `단체팀 ${index + 1}`, members: shuffle(members), size: members.length, label: `단체팀 ${index + 1}` });
  });

  settings.soloMembers.forEach((name) => {
    blocks.push({ kind: "solo", title: name, members: [name], size: 1, label: name });
  });

  return shuffle(blocks);
}

function distributeEmptySeats(emptySeats, gapCount) {
  const gaps = Array.from({ length: gapCount }, () => 0);

  for (let index = 0; index < emptySeats; index += 1) {
    const target = Math.floor(Math.random() * gapCount);
    gaps[target] += 1;
  }

  return gaps;
}

function findBlockPlacementStarts(totalSeats, blockSize, seatMap, separatedSeatSet) {
  const placementStarts = [];

  for (let startSeat = 1; startSeat <= totalSeats; startSeat += 1) {
    let separatedCount = 0;
    let fits = true;

    for (let offset = 0; offset < blockSize; offset += 1) {
      const seatNumber = ((startSeat - 1 + offset) % totalSeats) + 1;
      const seat = seatMap[seatNumber - 1];

      if (seat && seat.kind !== "empty") {
        fits = false;
        break;
      }

      if (separatedSeatSet.has(seatNumber)) {
        separatedCount += 1;

        if (separatedCount > 1) {
          fits = false;
          break;
        }
      }
    }

    if (fits) {
      placementStarts.push(startSeat);
    }
  }

  return placementStarts;
}

function generateResult(settings) {
  const groupPeople = settings.groupTeams.reduce((sum, team) => sum + team.length, 0);
  const totalPeople = groupPeople + settings.soloMembers.length;

  const teamBlocks = orderBlocksBySize([
    ...settings.groupTeams.map((members, index) => ({ blockId: index, kind: "group", title: `단체팀 ${index + 1}`, members: shuffle(members), size: members.length, label: `단체팀 ${index + 1}` }))
  ]);
  const soloBlocks = shuffle(settings.soloMembers.map((name, index) => ({ blockId: settings.groupTeams.length + index, kind: "solo", title: name, members: [name], size: 1, label: name })));
  const blocks = [...teamBlocks, ...soloBlocks];
  const separatedSeatSet = settings.separatedSeatSet ?? new Set(settings.separatedSeats);

  for (let attempt = 0; attempt < 200; attempt += 1) {
    const seatMap = Array.from({ length: settings.totalSeats }, (_, index) => {
      const seatNumber = index + 1;
      if (separatedSeatSet.has(seatNumber)) {
        return { kind: "empty", name: "분리 좌석" };
      }

      return null;
    });
    const assignments = [];
    let failed = false;

    for (const block of teamBlocks) {
      const fittingStarts = findBlockPlacementStarts(settings.totalSeats, block.size, seatMap, separatedSeatSet);

      if (fittingStarts.length === 0) {
        failed = true;
        break;
      }

      const startSeat = fittingStarts[getRandomInt(fittingStarts.length)];
      const seatNumbers = Array.from({ length: block.size }, (_, offset) => ((startSeat - 1 + offset) % settings.totalSeats) + 1);

      seatNumbers.forEach((seatNumber, index) => {
        seatMap[seatNumber - 1] = {
          blockId: block.blockId,
          kind: block.kind,
          name: block.label,
          member: block.members[index]
        };
      });

      assignments.push({
        kind: block.kind,
        title: block.title,
        members: block.members,
        seatNumbers
      });
    }

    if (failed) {
      continue;
    }

    const availableSeats = seatMap
      .map((seat, index) => (seat && seat.kind !== "empty" ? null : index + 1))
      .filter(Boolean);

    if (availableSeats.length < soloBlocks.length) {
      continue;
    }

    const soloSeatNumbers = shuffle(availableSeats).slice(0, soloBlocks.length);

    soloBlocks.forEach((block, index) => {
      const seatNumber = soloSeatNumbers[index];
      seatMap[seatNumber - 1] = {
        blockId: block.blockId,
        kind: block.kind,
        name: block.label,
        member: block.members[0]
      };

      assignments.push({
        kind: block.kind,
        title: block.title,
        members: block.members,
        seatNumbers: [seatNumber]
      });
    });

    for (let seatIndex = 0; seatIndex < seatMap.length; seatIndex += 1) {
      if (!seatMap[seatIndex]) {
        seatMap[seatIndex] = { kind: "empty", name: "빈 좌석" };
      }
    }

    return {
      totalSeats: settings.totalSeats,
      separatedSeatNumbers: settings.separatedSeats,
      separatedSeatText: settings.separatedSeats.map((seatNumber) => `${seatNumber}`).join(", "),
      totalPeople,
      blocks: assignments,
      seatMap
    };
  }

  return {
    error: "분리 좌석 조건 때문에 배정 가능한 좌석 배치를 만들 수 없습니다. 분리 좌석 위치를 줄이거나 더 넓은 좌석 구성을 입력해 주세요."
  };
}

function applyStoredSettings() {
  const stored = loadSettings();
  if (!stored || !getElement("totalSeats")) {
    return;
  }

  getElement("totalSeats").value = stored.totalSeats ?? "";
  getElement("separatedSeats").value = stored.separatedSeats ?? "";
  const combinedTeams = stored.combinedTeams
    ?? [
      ...(stored.groupTeams ? stored.groupTeams.split(/\r?\n/).filter(Boolean) : []),
      ...(stored.familyTeams ? stored.familyTeams.split(/\r?\n/).filter(Boolean) : [])
    ].join("\n");

  getElement("combinedTeams").value = combinedTeams;
  getElement("soloMembers").value = stored.soloMembers ?? "";
}

function renderResult(result) {
  getElement("totalSeatStat").textContent = result.totalSeats;
  getElement("assignedPeopleStat").textContent = result.totalPeople;
  getElement("separatedSeatStat").textContent = formatPairedSeatGroups(result.separatedSeatNumbers);

  const seatList = getElement("seatList");
  const seatMap = getElement("seatMap");
  const visibleBlocks = result.blocks.filter((block) => block.kind !== "solo");

  if (visibleBlocks.length === 0) {
    seatList.innerHTML = '<div class="empty-state">배정할 팀이나 인원이 없습니다.</div>';
  } else {
    seatList.innerHTML = visibleBlocks.map((block) => `
      <article class="seat-card">
        <div class="seat-card-header">
          <h3><span class="seat-title-name">${block.title}</span><span class="seat-title-inline"> ( 좌석 ${formatSeatRange(block.seatNumbers)} )</span></h3>
          <span class="seat-badge">${block.kind === "solo" ? "솔로" : "단체"}</span>
        </div>
        <ol class="member-list">${block.members.map((member) => `<li>${member}</li>`).join("")}</ol>
      </article>
    `).join("");
  }

  const seatCount = result.seatMap.length;

  seatMap.innerHTML = `
    <div class="seat-map-bg" aria-hidden="true">
      <img src="image/u1.png" alt="">
    </div>
    <div class="seat-map-core glass" id="seatMapCore">
      <span id="seatMapCoreLabel">Boat Deck</span>
      <strong id="seatMapCoreValue">${result.totalSeats}석</strong>
      <small id="seatMapCoreDetail">좌석을 누르면 정보가 표시됩니다.</small>
    </div>
    ${result.seatMap.map((seat, index) => {
    const seatNumber = index + 1;
    const label = seat.kind === "empty" ? "빈 좌석" : seat.member || seat.name;
    const displayLabel = formatSeatCellName(label);
    const position = calculateSeatPosition(index, seatCount);
    const blockColorStyle = seat.kind === "empty"
      ? "--seat-number-color: var(--muted);"
        : seat.kind === "solo"
          ? `--seat-cell-bg: ${getSoloSeatColor()}; --seat-number-color: ${getSoloSeatNumberColor()};`
          : `--seat-cell-bg: ${getBlockSeatColor(seat.blockId)}; --seat-number-color: ${getBlockSeatNumberColor(seat.blockId)};`;
    return `
      <div class="seat-cell ${seat.kind}" role="button" tabindex="0" aria-pressed="false" aria-label="${seatNumber}번 ${label}" data-seat-number="${seatNumber}" data-seat-label="${label}" data-seat-kind="${seat.kind}" style="left: ${position.x}%; top: ${position.y}%; ${blockColorStyle}">
        <span class="seat-cell-number">${seatNumber}번</span>
        <span class="seat-cell-name">${displayLabel}</span>
      </div>
    `;
  }).join("")}
  `;

  const seatMapCoreLabel = getElement("seatMapCoreLabel");
  const seatMapCoreValue = getElement("seatMapCoreValue");
  const seatMapCoreDetail = getElement("seatMapCoreDetail");
  const seatMapCore = getElement("seatMapCore");
  const seatCells = Array.from(seatMap.querySelectorAll(".seat-cell"));
  let selectedSeatCell = null;
  let selectedSeatTimer = null;
  let seatPopupLayer = getElement("seatPopupLayer");

  if (!seatPopupLayer) {
    seatPopupLayer = document.createElement("div");
    seatPopupLayer.id = "seatPopupLayer";
    seatPopupLayer.className = "seat-selection-overlay";
    document.body.appendChild(seatPopupLayer);
  }

  const clearSelectedSeat = () => {
    if (!selectedSeatCell) {
      return;
    }

    if (selectedSeatTimer) {
      clearTimeout(selectedSeatTimer);
      selectedSeatTimer = null;
    }

    seatPopupLayer.innerHTML = "";
    selectedSeatCell.setAttribute("aria-pressed", "false");
    seatMapCore.classList.remove("is-seat-selected");
    seatMapCoreLabel.textContent = "Boat Deck";
    seatMapCoreValue.textContent = `${result.totalSeats}석`;
    seatMapCoreDetail.textContent = "좌석을 누르면 정보가 표시됩니다.";
    selectedSeatCell = null;
  };

  const selectSeatCell = (seatCell) => {
    if (selectedSeatCell === seatCell) {
      clearSelectedSeat();
    }

    clearSelectedSeat();
    selectedSeatCell = seatCell;
    selectedSeatCell.setAttribute("aria-pressed", "true");

  const seatNumber = seatCell.dataset.seatNumber ?? "";
  const seatLabel = seatCell.dataset.seatLabel ?? "";
  const seatKind = seatCell.dataset.seatKind ?? "";
  seatMapCore.classList.add("is-seat-selected");
  seatMapCoreLabel.textContent = seatKind === "solo" ? "솔로 좌석" : seatKind === "group" ? "단체 좌석" : seatKind === "family" ? "가족 좌석" : "빈 좌석";
  seatMapCoreValue.textContent = `${seatNumber}번`;
  seatMapCoreDetail.textContent = seatLabel;

    const seatRect = seatCell.getBoundingClientRect();
    const popupSeat = seatCell.cloneNode(true);
    popupSeat.removeAttribute("id");
    popupSeat.classList.add("seat-popup");
    popupSeat.classList.add("is-selected");
    popupSeat.setAttribute("aria-pressed", "true");
    popupSeat.style.left = `${seatRect.left + (seatRect.width / 2)}px`;
    popupSeat.style.top = `${seatRect.top + (seatRect.height / 2)}px`;
    seatPopupLayer.appendChild(popupSeat);

    selectedSeatTimer = setTimeout(() => {
      clearSelectedSeat();
    }, 1200);
  };

  seatMap.addEventListener("pointerdown", (event) => {
    const seatCell = event.target.closest(".seat-cell");

    if (!seatCell || !seatMap.contains(seatCell)) {
      clearSelectedSeat();
      return;
    }

    selectSeatCell(seatCell);
  });

  seatMap.addEventListener("pointerup", clearSelectedSeat);
  seatMap.addEventListener("pointercancel", clearSelectedSeat);
  seatMap.addEventListener("pointerleave", clearSelectedSeat);

  seatMap.addEventListener("keydown", (event) => {
    const seatCell = event.target.closest(".seat-cell");

    if (!seatCell || !seatMap.contains(seatCell)) {
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectSeatCell(seatCell);
    }
  });
}

function handleSettingsPage() {
  applyStoredSettings();

  const form = getElement("settingsForm");
  const message = getElement("formMessage");
  const overlay = getElement("loadingOverlay");
  const resetButton = getElement("resetButton");
  const separatedSeatsInput = getElement("separatedSeats");
  const totalSeatsInput = getElement("totalSeats");

  const refreshTotalSeatsInput = () => {
    const digitsOnly = totalSeatsInput.value.replace(/\D+/g, "");

    if (digitsOnly !== totalSeatsInput.value) {
      totalSeatsInput.value = digitsOnly;
    }

    const totalSeats = Number.parseInt(totalSeatsInput.value, 10);

    if (!totalSeatsInput.value) {
      return;
    }

    if (!Number.isInteger(totalSeats) || totalSeats < 5 || totalSeats > 22) {
      message.textContent = "전체 좌석수는 5~22 사이 숫자로 입력해 주세요.";
      message.style.color = "var(--danger)";
    } else {
      message.textContent = "";
    }
  };

  const refreshSeparatedSeatsInput = () => {
    const totalSeats = Number.parseInt(totalSeatsInput.value, 10);

    if (!Number.isInteger(totalSeats)) {
      return;
    }

    const currentValue = separatedSeatsInput.value;
    const result = sanitizeSeparatedSeatsInput(currentValue, totalSeats);

    if (!result.changed) {
      return;
    }

    separatedSeatsInput.value = result.text;
    message.textContent = "총 좌석수를 넘는 숫자는 입력 불가능 합니다.";
    message.style.color = "var(--danger)";
  };

  resetButton.addEventListener("click", () => {
    resetLoadingOverlayState();
    form.reset();
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(RESULT_KEY);
    message.textContent = "설정이 초기화되었습니다.";
  });

  totalSeatsInput.addEventListener("input", refreshTotalSeatsInput);
  separatedSeatsInput.addEventListener("input", refreshSeparatedSeatsInput);
  totalSeatsInput.addEventListener("input", refreshSeparatedSeatsInput);

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const settings = {
      totalSeats: Number.parseInt(getElement("totalSeats").value, 10),
      separatedSeats: parseSeparatedSeats(getElement("separatedSeats").value, Number.parseInt(getElement("totalSeats").value, 10)),
      separatedSeatText: getElement("separatedSeats").value.trim(),
      ...parseCombinedTeams(getElement("combinedTeams").value),
      soloMembers: parseSoloMembers(getElement("soloMembers").value)
    };

    settings.separatedSeatSet = new Set(settings.separatedSeats);

    if (!Number.isInteger(settings.totalSeats) || settings.totalSeats < 5 || settings.totalSeats > 22) {
      message.textContent = "전체 좌석수는 5~22 사이 숫자로 입력해 주세요.";
      message.style.color = "var(--danger)";
      return;
    }

    const error = validateSettings(settings);
    if (error) {
      message.textContent = error;
      message.style.color = "var(--danger)";
      return;
    }

        separatedSeatText: settings.separatedSeatText,
    message.textContent = "설정을 저장하고 배정을 준비합니다.";

    saveSettings({
      totalSeats: getElement("totalSeats").value,
      separatedSeats: getElement("separatedSeats").value,
      combinedTeams: getElement("combinedTeams").value,
      soloMembers: getElement("soloMembers").value
    });

    overlay.hidden = false;
    if (loadingTimerId !== null) {
      window.clearTimeout(loadingTimerId);
    }

    loadingTimerId = window.setTimeout(() => {
      const result = generateResult(settings);

      if (result.error) {
        overlay.hidden = true;
        message.textContent = result.error;
        message.style.color = "var(--danger)";
        loadingTimerId = null;
        return;
      }

      localStorage.setItem(RESULT_KEY, JSON.stringify(result));
      window.location.href = "result.html";
      loadingTimerId = null;
    }, 10000);
  });
}

function handleResultPage() {
  const storedResult = localStorage.getItem(RESULT_KEY);
  if (!storedResult) {
    window.location.href = "index.html";
    return;
  }

  try {
    renderResult(JSON.parse(storedResult));
  } catch {
    localStorage.removeItem(RESULT_KEY);
    window.location.href = "index.html";
  }
}

function showStoredError() {
  const params = new URLSearchParams(window.location.search);
  const error = params.get("error");
  const message = getElement("formMessage");

  if (!error || !message) {
    return;
  }

  message.textContent = error;
  message.style.color = "var(--danger)";
}

const settingsHighlightTimers = new WeakMap();

function flashSettingsHighlight(element) {
  if (!element) {
    return;
  }

  element.classList.add("is-flashed");

  const previousTimer = settingsHighlightTimers.get(element);
  if (previousTimer) {
    window.clearTimeout(previousTimer);
  }

  const timer = window.setTimeout(() => {
    element.classList.remove("is-flashed");
    settingsHighlightTimers.delete(element);
  }, 500);

  settingsHighlightTimers.set(element, timer);
}

function setupSettingsAutoResetHighlights() {
  document.querySelectorAll(".page-settings .hero-link-note, .page-settings .hero-visual, .page-settings .guide-image-link").forEach((element) => {
    element.addEventListener("pointerenter", () => flashSettingsHighlight(element));
    element.addEventListener("click", () => flashSettingsHighlight(element));
  });
}

document.addEventListener("DOMContentLoaded", () => {
  if (getElement("settingsForm")) {
    setupSettingsAutoResetHighlights();
    resetLoadingOverlayState();
    handleSettingsPage();
    showStoredError();
  }

  if (getElement("seatList") && getElement("seatMap")) {
    handleResultPage();
  }
});

window.addEventListener("pageshow", () => {
  if (getElement("settingsForm")) {
    resetLoadingOverlayState();
  }
});