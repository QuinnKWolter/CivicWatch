<script lang="ts">
  import { onMount } from 'svelte';
  import { partyInitial, titleCasePersonName } from '$lib/format';
  import { withBase } from '$lib/paths';

  type Party =
    | 'Democratic'
    | 'Republican'
    | 'Independent'
    | null;

  type PointGroup =
    | 'scored'
    | 'unscored'
    | 'excluded';

  interface Props {
    legislators?: any[];
    title?: string;
    profileBase?: string;
    tablePageSize?: number;
    onSelect?: (legislator: any | null) => void;
  }

  interface NormalizedLegislator {
    key: string;
    profileId: string | null;
    name: string;
    handle: string | null;
    party: Party;
    state: string | null;
    chamber: string | null;
    ideology: number | null;
    postCount: number;
    included: boolean;
    raw: any;
  }

  interface LayoutItem {
    rowIndex: number;
    ideology: number;
    postCount: number;
  }

  interface GridLayoutItem {
    rowIndex: number;
    postCount: number;
  }

  interface LayoutRequest {
    version: number;
    width: number;
    height: number;
    scored: LayoutItem[];
    unscored: GridLayoutItem[];
    excluded: GridLayoutItem[];
  }

  interface LayoutPoint {
    rowIndex: number;
    x: number;
    y: number;
    r: number;
    group: PointGroup;
  }

  interface DrawPoint extends LayoutPoint {
    key: string;
  }

  interface ChamberGeometry {
    centerX: number;
    centerY: number;
    innerRadius: number;
    outerRadius: number;
    topBandHeight: number;
    excludedWidth: number;
  }

  interface LayoutResponse {
    version: number;
    points: LayoutPoint[];
    geometry: ChamberGeometry;
  }

  interface Palette {
    democratic: string;
    republican: string;
    independent: string;
    unknown: string;
    ink: string;
  }

  let {
    legislators = [],
    title = 'Roll call view',
    profileBase = '/who',
    tablePageSize = 100,
    onSelect
  }: Props = $props();

  const componentId = $props.id();
  const titleId = `${componentId}-title`;
  const captionId = `${componentId}-caption`;
  const summaryId = `${componentId}-summary`;
  const instructionsId = `${componentId}-instructions`;
  const liveId = `${componentId}-live`;

  let chartHost: HTMLDivElement;
  let canvas: HTMLCanvasElement;

  let mounted = $state(false);
  let chartWidth = $state(0);
  let layoutBusy = $state(false);
  let animating = $state(false);
  let tableOpen = $state(false);
  let tablePage = $state(0);
  let activeKey = $state<string | null>(null);
  let hoverKey = $state<string | null>(null);

  let points = $state<DrawPoint[]>([]);
  let geometry = $state<ChamberGeometry>({
    centerX: 0,
    centerY: 0,
    innerRadius: 0,
    outerRadius: 0,
    topBandHeight: 0,
    excludedWidth: 0
  });

  let worker: Worker | null = null;
  let workerUrl: string | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let reducedMotionQuery: MediaQueryList | null = null;
  let reducedMotion = false;
  let layoutVersion = 0;
  let latestRequest: LayoutRequest | null = null;
  let lastDataSignature = '';
  let animationFrame = 0;
  let pointerFrame = 0;
  let pendingPointer:
    | { x: number; y: number }
    | null = null;
  let hasRendered = false;

  let hitIndex = new Map<string, DrawPoint[]>();
  let keyboardOrder: string[] = [];
  let layoutDurationByVersion = new Map<
    number,
    number
  >();

  let palette: Palette = {
    democratic: '#274b6e',
    republican: '#a13530',
    independent: '#7a6a4a',
    unknown: '#9c9787',
    ink: '#1a1917'
  };

  const normalizedRows = $derived.by(() =>
    legislators
      .map((legislator, index) =>
        normalizeLegislator(legislator, index)
      )
      .filter(
        (
          legislator
        ): legislator is NormalizedLegislator =>
          legislator !== null
      )
  );

  const rowMap = $derived.by(
    () =>
      new Map(
        normalizedRows.map((row) => [row.key, row])
      )
  );

  const includedRows = $derived(
    normalizedRows.filter((row) => row.included)
  );

  const scoredRows = $derived(
    includedRows.filter(
      (row) => row.ideology !== null
    )
  );

  const unscoredRows = $derived(
    includedRows.filter(
      (row) => row.ideology === null
    )
  );

  const excludedRows = $derived(
    normalizedRows.filter((row) => !row.included)
  );

  const hasPostCounts = $derived(
    scoredRows.some((row) => row.postCount > 0)
  );

  const chartHeight = $derived(
    chartWidth < 640
      ? Math.round(
          Math.max(
            340,
            Math.min(440, chartWidth * 1.02)
          )
        )
      : Math.round(
          Math.max(
            410,
            Math.min(560, chartWidth * 0.54)
          )
        )
  );

  const activeRow = $derived(
    activeKey ? rowMap.get(activeKey) ?? null : null
  );

  const hoverRow = $derived(
    hoverKey ? rowMap.get(hoverKey) ?? null : null
  );

  const activePoint = $derived(
    activeKey
      ? points.find((point) => point.key === activeKey) ??
          null
      : null
  );

  const hoverPoint = $derived(
    hoverKey
      ? points.find((point) => point.key === hoverKey) ??
          null
      : null
  );

  const safeTablePageSize = $derived(
    Number.isFinite(tablePageSize)
      ? Math.min(
          250,
          Math.max(50, Math.trunc(tablePageSize))
        )
      : 100
  );

  const sortedTableRows = $derived.by(() =>
    [...normalizedRows].sort(compareTableRows)
  );

  const tablePageCount = $derived(
    Math.max(
      1,
      Math.ceil(
        sortedTableRows.length / safeTablePageSize
      )
    )
  );

  const visibleTableRows = $derived(
    sortedTableRows.slice(
      tablePage * safeTablePageSize,
      tablePage * safeTablePageSize +
        safeTablePageSize
    )
  );

  const tableStart = $derived(
    sortedTableRows.length
      ? tablePage * safeTablePageSize + 1
      : 0
  );

  const tableEnd = $derived(
    Math.min(
      sortedTableRows.length,
      (tablePage + 1) * safeTablePageSize
    )
  );

  const chartSummary = $derived.by(() => {
    const democratic = includedRows.filter(
      (row) => row.party === 'Democratic'
    ).length;

    const republican = includedRows.filter(
      (row) => row.party === 'Republican'
    ).length;

    const independent = includedRows.filter(
      (row) => row.party === 'Independent'
    ).length;

    const unknown =
      includedRows.length -
      democratic -
      republican -
      independent;

    const parts = [
      `${formatNumber(includedRows.length)} legislators are included in this view.`,
      `${formatNumber(scoredRows.length)} have voting-record ideology scores and ${formatNumber(unscoredRows.length)} do not.`,
      `${formatNumber(democratic)} are labeled Democratic, ${formatNumber(republican)} Republican, ${formatNumber(independent)} Independent, and ${formatNumber(unknown)} have unknown party information.`
    ];

    if (excludedRows.length) {
      parts.push(
        `${formatNumber(excludedRows.length)} legislators are outside the current filter and appear in the excluded cluster.`
      );
    }

    return parts.join(' ');
  });

  const activeAnnouncement = $derived(
    activeRow
      ? describeLegislator(activeRow)
      : 'No legislator selected.'
  );

  $effect(() => {
    const maximumPage = Math.max(
      0,
      tablePageCount - 1
    );

    if (tablePage > maximumPage) {
      tablePage = maximumPage;
    }
  });

  $effect(() => {
    const rows = normalizedRows;
    const width = chartWidth;
    const height = chartHeight;

    if (!mounted || width < 160 || height < 240) {
      return;
    }

    requestLayout(rows, width, height);
  });

  function finiteNumber(
    value: unknown
  ): number | null {
    if (
      value === null ||
      value === undefined ||
      value === ''
    ) {
      return null;
    }

    const number =
      typeof value === 'number'
        ? value
        : Number(value);

    return Number.isFinite(number) ? number : null;
  }

  function nonNegativeInteger(
    value: unknown
  ): number {
    const number = finiteNumber(value);

    return number === null
      ? 0
      : Math.max(0, Math.round(number));
  }

  function cleanText(
    value: unknown
  ): string | null {
    if (typeof value !== 'string') return null;

    const cleaned = value.trim();

    if (
      !cleaned ||
      /^(?:nan|na|n\/a|null|none)$/i.test(cleaned)
    ) {
      return null;
    }

    return cleaned;
  }

  function normalizeParty(
    value: unknown
  ): Party {
    const party = cleanText(value);

    if (
      party === 'Democratic' ||
      party === 'Republican' ||
      party === 'Independent'
    ) {
      return party;
    }

    return null;
  }

  function normalizeChamber(
    value: unknown
  ): string | null {
    const chamber = cleanText(value);

    if (!chamber) return null;
    if (chamber === 'H') return 'House';
    if (chamber === 'S') return 'Senate';

    return chamber;
  }

  function normalizeLegislator(
    legislator: any,
    index: number
  ): NormalizedLegislator | null {
    if (
      !legislator ||
      typeof legislator !== 'object'
    ) {
      return null;
    }

    const profileId =
      cleanText(legislator.lid) ??
      cleanText(legislator.id);

    const handle =
      cleanText(legislator.handle) ??
      cleanText(legislator.username);

    const rawName =
      cleanText(legislator.name) ??
      cleanText(legislator.displayName) ??
      cleanText(legislator.display_name) ??
      null;

    const name =
      rawName
        ? titleCasePersonName(rawName)
        : (handle ? `@${handle}` : null) ??
          'Unnamed legislator';

    const ideology =
      finiteNumber(legislator.mrpIdeology) ??
      finiteNumber(legislator.mrp_ideology) ??
      finiteNumber(legislator.ideology) ??
      finiteNumber(legislator.position);

    const postCount =
      nonNegativeInteger(legislator.postCount) ||
      nonNegativeInteger(legislator.totalPosts) ||
      nonNegativeInteger(legislator.total_posts) ||
      nonNegativeInteger(legislator.topicPosts) ||
      nonNegativeInteger(legislator.posts);

    const included =
      legislator.excluded !== true &&
      legislator.included !== false &&
      legislator.isIncluded !== false &&
      legislator.matchesFilter !== false;

    return {
      key: `${profileId ?? 'row'}-${index}`,
      profileId,
      name,
      handle,
      party: normalizeParty(legislator.party),
      state: cleanText(legislator.state),
      chamber: normalizeChamber(legislator.chamber),
      ideology,
      postCount,
      included,
      raw: legislator
    };
  }

  function compareTableRows(
    a: NormalizedLegislator,
    b: NormalizedLegislator
  ): number {
    if (a.included !== b.included) {
      return a.included ? -1 : 1;
    }

    if (
      a.ideology !== null &&
      b.ideology === null
    ) {
      return -1;
    }

    if (
      a.ideology === null &&
      b.ideology !== null
    ) {
      return 1;
    }

    if (
      a.ideology !== null &&
      b.ideology !== null &&
      a.ideology !== b.ideology
    ) {
      return a.ideology - b.ideology;
    }

    return a.name.localeCompare(b.name);
  }

  function profileHref(
    legislator: NormalizedLegislator
  ): string | null {
    if (!legislator.profileId) return null;

    const safeBase = profileBase.startsWith('/')
      ? profileBase.replace(/\/+$/, '')
      : '/who';

    return withBase(`${safeBase}/${encodeURIComponent(
      legislator.profileId
    )}`);
  }

  function formatNumber(value: number): string {
    return value.toLocaleString('en-US');
  }

  function formatIdeology(
    value: number | null
  ): string {
    return value === null
      ? '— (not scored)'
      : value.toFixed(3);
  }

  function partyLabel(party: Party): string {
    return party ?? 'Party unknown';
  }

  function locationLabel(
    legislator: NormalizedLegislator
  ): string {
    const parts = [
      legislator.state,
      legislator.chamber
    ].filter(Boolean);

    return parts.length ? parts.join(' · ') : '—';
  }

  function describeLegislator(
    legislator: NormalizedLegislator
  ): string {
    const ideology =
      legislator.ideology === null
        ? 'Ideology not scored.'
        : `Ideology score ${legislator.ideology.toFixed(
            3
          )}.`;

    const activity = legislator.postCount
      ? `${formatNumber(
          legislator.postCount
        )} posts.`
      : 'Post count unavailable or zero.';

    return `${legislator.name}. ${partyLabel(
      legislator.party
    )}. ${locationLabel(
      legislator
    )}. ${ideology} ${activity}`;
  }

  function hashRows(
    rows: NormalizedLegislator[]
  ): string {
    let hash = 2166136261;

    for (const row of rows) {
      const value = `${row.key}|${
        row.included ? 1 : 0
      }|${row.ideology ?? 'n'}|${row.postCount}`;

      for (let index = 0; index < value.length; index++) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
      }
    }

    return `${rows.length}:${hash >>> 0}`;
  }

  function calculateLayout(
    request: LayoutRequest
  ): LayoutResponse {
    const clamp = (
      value: number,
      minimum: number,
      maximum: number
    ) =>
      Math.min(maximum, Math.max(minimum, value));

    const {
      width,
      height,
      scored,
      unscored,
      excluded
    } = request;

    const points: LayoutPoint[] = [];
    const hasTopBand =
      unscored.length > 0 || excluded.length > 0;

    const topBandHeight = hasTopBand
      ? clamp(height * 0.17, 62, 94)
      : 34;

    const excludedWidth = excluded.length
      ? clamp(width * 0.22, 112, 190)
      : 0;

    function placeGrid(
      items: GridLayoutItem[],
      x: number,
      y: number,
      availableWidth: number,
      availableHeight: number,
      group: PointGroup
    ) {
      if (
        !items.length ||
        availableWidth <= 0 ||
        availableHeight <= 0
      ) {
        return;
      }

      const initialSpacing = Math.max(
        1.8,
        Math.sqrt(
          (availableWidth * availableHeight) /
            items.length
        )
      );

      const radius = clamp(
        (initialSpacing - 0.7) / 2,
        0.65,
        2.15
      );

      const spacing = Math.max(
        1.7,
        radius * 2 + 0.7
      );

      const columns = Math.max(
        1,
        Math.floor(availableWidth / spacing)
      );

      const rows = Math.max(
        1,
        Math.ceil(items.length / columns)
      );

      const xStep = Math.min(
        spacing,
        availableWidth / columns
      );

      const yStep = Math.min(
        spacing,
        availableHeight / rows
      );

      const usedWidth = Math.min(
        availableWidth,
        columns * xStep
      );

      const usedHeight = Math.min(
        availableHeight,
        rows * yStep
      );

      const startX =
        x +
        Math.max(
          radius,
          (availableWidth - usedWidth) / 2 +
            xStep / 2
        );

      const startY =
        y +
        Math.max(
          radius,
          (availableHeight - usedHeight) / 2 +
            yStep / 2
        );

      items.forEach((item, index) => {
        const column = index % columns;
        const row = Math.floor(index / columns);

        points.push({
          rowIndex: item.rowIndex,
          x: startX + column * xStep,
          y: startY + row * yStep,
          r: Math.min(radius, xStep * 0.42, yStep * 0.42),
          group
        });
      });
    }

    if (excluded.length) {
      placeGrid(
        excluded,
        16,
        24,
        Math.max(70, excludedWidth - 24),
        Math.max(24, topBandHeight - 34),
        'excluded'
      );
    }

    if (unscored.length) {
      const startX = excludedWidth
        ? excludedWidth + 18
        : 16;

      placeGrid(
        unscored,
        startX,
        24,
        Math.max(80, width - startX - 16),
        Math.max(24, topBandHeight - 34),
        'unscored'
      );
    }

    const centerX = width / 2;
    const centerY = height - 30;

    const outerRadius = Math.max(
      92,
      Math.min(
        width * 0.47,
        centerY - topBandHeight - 18
      )
    );

    const innerRadius = Math.max(
      38,
      outerRadius * 0.34
    );

    if (scored.length) {
      let dotRadius = clamp(
        width / 440,
        1.1,
        2.15
      );

      let seats: {
        x: number;
        y: number;
        radius: number;
      }[] = [];

      for (
        let attempt = 0;
        attempt < 14;
        attempt++
      ) {
        seats = [];

        const gap = dotRadius * 2 + 0.8;

        for (
          let ringRadius = innerRadius;
          ringRadius <= outerRadius + 0.01;
          ringRadius += gap
        ) {
          const seatCount = Math.max(
            6,
            Math.floor(
              (Math.PI * ringRadius) / gap
            )
          );

          for (
            let seat = 0;
            seat < seatCount;
            seat++
          ) {
            const angle =
              Math.PI -
              ((seat + 0.5) / seatCount) *
                Math.PI;

            seats.push({
              x:
                centerX +
                Math.cos(angle) * ringRadius,
              y:
                centerY -
                Math.sin(angle) * ringRadius,
              radius: ringRadius
            });
          }
        }

        if (
          seats.length >= scored.length ||
          dotRadius <= 0.68
        ) {
          break;
        }

        dotRadius *= 0.9;
      }

      const sortedPeople = [...scored].sort(
        (a, b) =>
          a.ideology - b.ideology ||
          a.rowIndex - b.rowIndex
      );

      if (seats.length >= sortedPeople.length) {
        const selectedSeats: typeof seats = [];
        const step =
          seats.length / sortedPeople.length;

        for (
          let index = 0;
          index < sortedPeople.length;
          index++
        ) {
          selectedSeats.push(
            seats[
              Math.min(
                seats.length - 1,
                Math.floor((index + 0.5) * step)
              )
            ]
          );
        }

        selectedSeats.sort(
          (a, b) => a.x - b.x || a.y - b.y
        );

        const binSize = Math.round(
          clamp(
            Math.sqrt(sortedPeople.length),
            28,
            72
          )
        );

        for (
          let offset = 0;
          offset < sortedPeople.length;
          offset += binSize
        ) {
          const end = Math.min(
            sortedPeople.length,
            offset + binSize
          );

          const localPeople = sortedPeople
            .slice(offset, end)
            .sort(
              (a, b) =>
                b.postCount - a.postCount ||
                a.ideology - b.ideology
            );

          const localSeats = selectedSeats
            .slice(offset, end)
            .sort(
              (a, b) =>
                a.radius - b.radius ||
                a.x - b.x
            );

          localPeople.forEach(
            (person, localIndex) => {
              const seat = localSeats[localIndex];

              points.push({
                rowIndex: person.rowIndex,
                x: seat.x,
                y: seat.y,
                r: dotRadius,
                group: 'scored'
              });
            }
          );
        }
      } else {
        const radialRange =
          outerRadius - innerRadius;
        const ringCount = Math.max(
          1,
          Math.floor(
            radialRange /
              Math.max(1.6, dotRadius * 2 + 0.7)
          )
        );

        sortedPeople.forEach((person, index) => {
          const fraction =
            sortedPeople.length === 1
              ? 0.5
              : index /
                (sortedPeople.length - 1);

          const angle =
            Math.PI - fraction * Math.PI;

          const activityRank =
            person.postCount > 0
              ? Math.log1p(person.postCount)
              : 0;

          const radius =
            innerRadius +
            ((index +
              Math.floor(activityRank * 13)) %
              ringCount) *
              (radialRange /
                Math.max(1, ringCount - 1));

          points.push({
            rowIndex: person.rowIndex,
            x:
              centerX +
              Math.cos(angle) * radius,
            y:
              centerY -
              Math.sin(angle) * radius,
            r: dotRadius,
            group: 'scored'
          });
        });
      }
    }

    return {
      version: request.version,
      points,
      geometry: {
        centerX,
        centerY,
        innerRadius,
        outerRadius,
        topBandHeight,
        excludedWidth
      }
    };
  }

  function requestLayout(
    rows: NormalizedLegislator[],
    width: number,
    height: number
  ): void {
    const version = ++layoutVersion;
    const signature = hashRows(rows);

    const duration =
      signature === lastDataSignature
        ? 0
        : reducedMotion
          ? 0
          : 600;

    lastDataSignature = signature;
    layoutDurationByVersion.set(version, duration);

    const request: LayoutRequest = {
      version,
      width,
      height,
      scored: [],
      unscored: [],
      excluded: []
    };

    rows.forEach((row, rowIndex) => {
      if (!row.included) {
        request.excluded.push({
          rowIndex,
          postCount: row.postCount
        });

        return;
      }

      if (row.ideology === null) {
        request.unscored.push({
          rowIndex,
          postCount: row.postCount
        });

        return;
      }

      request.scored.push({
        rowIndex,
        ideology: row.ideology,
        postCount: row.postCount
      });
    });

    latestRequest = request;
    layoutBusy = true;
    hoverKey = null;

    if (worker) {
      worker.postMessage(request);
      return;
    }

    window.setTimeout(() => {
      if (version !== layoutVersion) return;
      applyLayout(calculateLayout(request));
    }, 0);
  }

  function createLayoutWorker(): Worker | null {
    if (
      typeof Worker === 'undefined' ||
      typeof Blob === 'undefined'
    ) {
      return null;
    }

    try {
      const source = `
        const calculateLayout = ${calculateLayout.toString()};
        self.onmessage = (event) => {
          self.postMessage(calculateLayout(event.data));
        };
      `;

      const blob = new Blob([source], {
        type: 'text/javascript'
      });

      workerUrl = URL.createObjectURL(blob);

      const instance = new Worker(workerUrl);

      instance.onmessage = (
        event: MessageEvent<LayoutResponse>
      ) => {
        if (
          event.data.version !== layoutVersion
        ) {
          return;
        }

        applyLayout(event.data);
      };

      instance.onerror = () => {
        instance.terminate();
        worker = null;

        if (
          latestRequest &&
          latestRequest.version === layoutVersion
        ) {
          applyLayout(
            calculateLayout(latestRequest)
          );
        }
      };

      return instance;
    } catch {
      if (workerUrl) {
        URL.revokeObjectURL(workerUrl);
        workerUrl = null;
      }

      return null;
    }
  }

  function applyLayout(
    response: LayoutResponse
  ): void {
    if (response.version !== layoutVersion) return;

    const rows = normalizedRows;

    const targetPoints: DrawPoint[] =
      response.points
        .map((point) => {
          const row = rows[point.rowIndex];

          if (!row) return null;

          return {
            ...point,
            key: row.key
          };
        })
        .filter(
          (
            point
          ): point is DrawPoint => point !== null
        );

    geometry = response.geometry;
    palette = readPalette();

    cancelAnimationFrame(animationFrame);

    const duration =
      layoutDurationByVersion.get(
        response.version
      ) ?? 0;

    layoutDurationByVersion.delete(
      response.version
    );

    if (
      reducedMotion ||
      duration <= 0 ||
      !canvas
    ) {
      finishLayout(targetPoints);
      return;
    }

    const previousByKey = new Map(
      points.map((point) => [point.key, point])
    );

    const startingPoints = targetPoints.map(
      (point) => {
        const previous =
          previousByKey.get(point.key);

        if (previous) return previous;

        if (point.group === 'unscored') {
          return {
            ...point,
            x: response.geometry.centerX,
            y:
              response.geometry.topBandHeight /
              2,
            r: Math.max(0.4, point.r * 0.55)
          };
        }

        if (point.group === 'excluded') {
          return {
            ...point,
            x: 24,
            y: 26,
            r: Math.max(0.4, point.r * 0.55)
          };
        }

        return {
          ...point,
          x: response.geometry.centerX,
          y: response.geometry.centerY,
          r: Math.max(0.4, point.r * 0.55)
        };
      }
    );

    const startedAt = performance.now();
    animating = true;

    function frame(now: number) {
      if (response.version !== layoutVersion) {
        return;
      }

      const elapsed = now - startedAt;
      const context = prepareCanvas();

      if (!context) {
        finishLayout(targetPoints);
        return;
      }

      context.clearRect(
        0,
        0,
        chartWidth,
        chartHeight
      );

      targetPoints.forEach((target, index) => {
        const start = startingPoints[index];
        const delay =
          ((index % 80) / 80) * 110;

        const rawProgress = Math.min(
          1,
          Math.max(
            0,
            (elapsed - delay) /
              Math.max(1, duration - 110)
          )
        );

        const eased =
          1 - Math.pow(1 - rawProgress, 3);

        drawMark(
          context,
          target,
          start.x +
            (target.x - start.x) * eased,
          start.y +
            (target.y - start.y) * eased,
          start.r +
            (target.r - start.r) * eased
        );
      });

      if (elapsed < duration) {
        animationFrame =
          requestAnimationFrame(frame);
      } else {
        finishLayout(targetPoints);
      }
    }

    animationFrame = requestAnimationFrame(frame);
  }

  function finishLayout(
    targetPoints: DrawPoint[]
  ): void {
    points = targetPoints;
    animating = false;
    layoutBusy = false;
    hasRendered = true;

    buildInteractionIndexes(targetPoints);
    drawPoints(targetPoints);

    if (
      activeKey &&
      !targetPoints.some(
        (point) => point.key === activeKey
      )
    ) {
      setActive(null);
    }
  }

  function readPalette(): Palette {
    if (!chartHost) return palette;

    const styles = getComputedStyle(chartHost);

    function read(
      token: string,
      fallback: string
    ) {
      return (
        styles.getPropertyValue(token).trim() ||
        fallback
      );
    }

    return {
      democratic: read(
        '--color-ballot-blue',
        '#274b6e'
      ),
      republican: read(
        '--color-ballot-red',
        '#a13530'
      ),
      independent: read(
        '--color-independent',
        '#7a6a4a'
      ),
      unknown: read(
        '--color-mute-soft',
        '#9c9787'
      ),
      ink: read('--color-ink', '#1a1917')
    };
  }

  function prepareCanvas():
    | CanvasRenderingContext2D
    | null {
    if (!canvas || !chartWidth || !chartHeight) {
      return null;
    }

    const context = canvas.getContext('2d');

    if (!context) return null;

    const ratio = Math.min(
      window.devicePixelRatio || 1,
      2
    );

    const pixelWidth = Math.round(
      chartWidth * ratio
    );

    const pixelHeight = Math.round(
      chartHeight * ratio
    );

    if (
      canvas.width !== pixelWidth ||
      canvas.height !== pixelHeight
    ) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
      canvas.style.width = `${chartWidth}px`;
      canvas.style.height = `${chartHeight}px`;
    }

    context.setTransform(
      ratio,
      0,
      0,
      ratio,
      0,
      0
    );

    return context;
  }

  function drawPoints(
    drawPoints: DrawPoint[]
  ): void {
    const context = prepareCanvas();

    if (!context) return;

    context.clearRect(
      0,
      0,
      chartWidth,
      chartHeight
    );

    for (const point of drawPoints) {
      drawMark(
        context,
        point,
        point.x,
        point.y,
        point.r
      );
    }
  }

  function drawMark(
    context: CanvasRenderingContext2D,
    point: DrawPoint,
    x: number,
    y: number,
    radius: number
  ): void {
    const row = rowMap.get(point.key);

    if (!row) return;

    const color =
      row.party === 'Democratic'
        ? palette.democratic
        : row.party === 'Republican'
          ? palette.republican
          : row.party === 'Independent'
            ? palette.independent
            : palette.unknown;

    context.save();

    context.globalAlpha =
      point.group === 'excluded'
        ? 0.25
        : point.group === 'unscored'
          ? 0.58
          : 0.9;

    context.fillStyle = color;
    context.strokeStyle = color;
    context.lineWidth = Math.max(
      0.7,
      radius * 0.48
    );

    if (row.party === 'Republican') {
      context.fillRect(
        x - radius,
        y - radius,
        radius * 2,
        radius * 2
      );
    } else if (
      row.party === 'Independent'
    ) {
      context.beginPath();
      context.moveTo(x, y - radius * 1.25);
      context.lineTo(x + radius * 1.25, y);
      context.lineTo(x, y + radius * 1.25);
      context.lineTo(x - radius * 1.25, y);
      context.closePath();
      context.fill();
    } else if (row.party === null) {
      context.beginPath();
      context.arc(
        x,
        y,
        radius,
        0,
        Math.PI * 2
      );
      context.stroke();
    } else {
      context.beginPath();
      context.arc(
        x,
        y,
        radius,
        0,
        Math.PI * 2
      );
      context.fill();
    }

    context.restore();
  }

  function buildInteractionIndexes(
    nextPoints: DrawPoint[]
  ): void {
    const cellSize = 14;
    const nextIndex = new Map<
      string,
      DrawPoint[]
    >();

    for (const point of nextPoints) {
      const column = Math.floor(
        point.x / cellSize
      );

      const row = Math.floor(
        point.y / cellSize
      );

      const key = `${column}:${row}`;
      const bucket = nextIndex.get(key);

      if (bucket) {
        bucket.push(point);
      } else {
        nextIndex.set(key, [point]);
      }
    }

    hitIndex = nextIndex;

    keyboardOrder = [...nextPoints]
      .sort((a, b) => {
        const rowA = rowMap.get(a.key);
        const rowB = rowMap.get(b.key);

        if (!rowA || !rowB) return 0;

        const groupOrder = (
          point: DrawPoint
        ) =>
          point.group === 'scored'
            ? 0
            : point.group === 'unscored'
              ? 1
              : 2;

        const groupDifference =
          groupOrder(a) - groupOrder(b);

        if (groupDifference) {
          return groupDifference;
        }

        if (
          rowA.ideology !== null &&
          rowB.ideology !== null
        ) {
          return (
            rowA.ideology - rowB.ideology ||
            rowA.name.localeCompare(rowB.name)
          );
        }

        return rowA.name.localeCompare(
          rowB.name
        );
      })
      .map((point) => point.key);
  }

  function pointerCoordinates(
    event: PointerEvent
  ): { x: number; y: number } {
    const bounds =
      canvas.getBoundingClientRect();

    return {
      x:
        (event.clientX - bounds.left) *
        (chartWidth / bounds.width),
      y:
        (event.clientY - bounds.top) *
        (chartHeight / bounds.height)
    };
  }

  function hitTest(
    x: number,
    y: number
  ): DrawPoint | null {
    const cellSize = 14;
    const column = Math.floor(x / cellSize);
    const row = Math.floor(y / cellSize);

    let nearest: DrawPoint | null = null;
    let nearestDistance = Infinity;

    for (
      let columnOffset = -1;
      columnOffset <= 1;
      columnOffset++
    ) {
      for (
        let rowOffset = -1;
        rowOffset <= 1;
        rowOffset++
      ) {
        const bucket = hitIndex.get(
          `${column + columnOffset}:${
            row + rowOffset
          }`
        );

        if (!bucket) continue;

        for (const point of bucket) {
          const distance = Math.hypot(
            point.x - x,
            point.y - y
          );

          const threshold = Math.max(
            6,
            point.r + 4
          );

          if (
            distance <= threshold &&
            distance < nearestDistance
          ) {
            nearest = point;
            nearestDistance = distance;
          }
        }
      }
    }

    return nearest;
  }

  function handlePointerMove(
    event: PointerEvent
  ): void {
    if (layoutBusy || animating) return;

    pendingPointer =
      pointerCoordinates(event);

    if (pointerFrame) return;

    pointerFrame = requestAnimationFrame(() => {
      pointerFrame = 0;

      if (!pendingPointer) return;

      const match = hitTest(
        pendingPointer.x,
        pendingPointer.y
      );

      hoverKey = match?.key ?? null;

      if (canvas) {
        canvas.style.cursor = match
          ? 'pointer'
          : 'default';
      }
    });
  }

  function handlePointerLeave(): void {
    pendingPointer = null;
    hoverKey = null;

    if (canvas) {
      canvas.style.cursor = 'default';
    }
  }

  function handleCanvasClick(
    event: MouseEvent
  ): void {
    if (layoutBusy || animating) return;

    const bounds =
      canvas.getBoundingClientRect();

    const x =
      (event.clientX - bounds.left) *
      (chartWidth / bounds.width);

    const y =
      (event.clientY - bounds.top) *
      (chartHeight / bounds.height);

    const match = hitTest(x, y);

    setActive(match?.key ?? null);
  }

  function setActive(
    key: string | null
  ): void {
    activeKey = key;

    if (!onSelect) return;

    if (!key) {
      onSelect(null);
      return;
    }

    onSelect(rowMap.get(key)?.raw ?? null);
  }

  function handleCanvasFocus(): void {
    if (
      activeKey ||
      keyboardOrder.length === 0
    ) {
      return;
    }

    const scoredKeys = keyboardOrder.filter(
      (key) =>
        points.find(
          (point) =>
            point.key === key &&
            point.group === 'scored'
        )
    );

    const initial =
      scoredKeys[
        Math.floor(scoredKeys.length / 2)
      ] ??
      keyboardOrder[
        Math.floor(keyboardOrder.length / 2)
      ];

    setActive(initial ?? null);
  }

  function handleKeydown(
    event: KeyboardEvent
  ): void {
    if (!keyboardOrder.length) return;

    let index = activeKey
      ? keyboardOrder.indexOf(activeKey)
      : -1;

    if (index < 0) {
      index = Math.floor(
        keyboardOrder.length / 2
      );
    }

    let nextIndex = index;

    switch (event.key) {
      case 'ArrowLeft':
        nextIndex = Math.max(0, index - 1);
        break;

      case 'ArrowRight':
        nextIndex = Math.min(
          keyboardOrder.length - 1,
          index + 1
        );
        break;

      case 'ArrowUp':
        nextIndex = Math.max(0, index - 10);
        break;

      case 'ArrowDown':
        nextIndex = Math.min(
          keyboardOrder.length - 1,
          index + 10
        );
        break;

      case 'Home':
        nextIndex = 0;
        break;

      case 'End':
        nextIndex =
          keyboardOrder.length - 1;
        break;

      case 'Enter': {
        if (!activeRow) return;

        const href = profileHref(activeRow);

        if (href) {
          window.location.assign(href);
        }

        return;
      }

      case 'Escape':
        setActive(null);
        return;

      default:
        return;
    }

    event.preventDefault();

    setActive(
      keyboardOrder[nextIndex] ?? null
    );
  }

  function arcPath(radius: number): string {
    if (!radius) return '';

    return [
      `M ${geometry.centerX - radius} ${geometry.centerY}`,
      `A ${radius} ${radius} 0 0 1`,
      `${geometry.centerX + radius} ${geometry.centerY}`
    ].join(' ');
  }

  function tooltipStyle(
    point: DrawPoint
  ): string {
    const tooltipWidth = 240;

    const left = Math.min(
      Math.max(8, point.x + 12),
      Math.max(8, chartWidth - tooltipWidth - 8)
    );

    const top =
      point.y > 116
        ? point.y - 102
        : point.y + 12;

    return `left:${left}px;top:${Math.max(
      8,
      top
    )}px`;
  }

  function changeTablePage(
    difference: number
  ): void {
    tablePage = Math.min(
      tablePageCount - 1,
      Math.max(0, tablePage + difference)
    );
  }

  onMount(() => {
    mounted = true;

    reducedMotionQuery = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    );

    reducedMotion = reducedMotionQuery.matches;

    const handleMotionChange = (
      event: MediaQueryListEvent
    ) => {
      reducedMotion = event.matches;
    };

    reducedMotionQuery.addEventListener(
      'change',
      handleMotionChange
    );

    worker = createLayoutWorker();

    resizeObserver = new ResizeObserver((entries) => {
      const width = Math.floor(
        entries[0]?.contentRect.width ?? 0
      );

      if (
        width > 0 &&
        Math.abs(width - chartWidth) > 1
      ) {
        chartWidth = width;
      }
    });

    resizeObserver.observe(chartHost);

    chartWidth = Math.floor(
      chartHost.getBoundingClientRect().width
    );

    return () => {
      mounted = false;

      reducedMotionQuery?.removeEventListener(
        'change',
        handleMotionChange
      );

      resizeObserver?.disconnect();
      resizeObserver = null;

      worker?.terminate();
      worker = null;

      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame);
        animationFrame = 0;
      }

      if (pointerFrame) {
        window.cancelAnimationFrame(pointerFrame);
        pointerFrame = 0;
      }

      if (workerUrl) {
        URL.revokeObjectURL(workerUrl);
        workerUrl = null;
      }
    };
  });
</script>

<figure
  class="chamber"
  aria-labelledby={titleId}
>
  <figcaption>
    <div class="heading-row">
      <div>
        <p class="eyebrow">
          Legislative population
        </p>

        <h2 id={titleId}>{title}</h2>
      </div>

      <p class="population-count">
        {formatNumber(includedRows.length)}
        included
      </p>
    </div>

    <p id={captionId} class="caption">
      Legislators with voting-record data are
      arranged from more liberal on the left to
      more conservative on the right.
      {#if hasPostCounts}
        More-active legislators sit closer to the
        front of the chamber.
      {/if}
      {formatNumber(unscoredRows.length)}
      {unscoredRows.length === 1
        ? 'legislator is'
        : 'legislators are'}
      shown above the chamber because no ideology
      score is available.
    </p>

    <p id={summaryId} class="chart-summary">
      {chartSummary}
    </p>
  </figcaption>

  <ul
    class="legend"
    aria-label="Party legend"
  >
    <li>
      <span
        class="legend-mark democratic"
        aria-hidden="true"
      ></span>
      Democratic
    </li>

    <li>
      <span
        class="legend-mark republican"
        aria-hidden="true"
      ></span>
      Republican
    </li>

    <li>
      <span
        class="legend-mark independent"
        aria-hidden="true"
      ></span>
      Independent
    </li>

    <li>
      <span
        class="legend-mark unknown"
        aria-hidden="true"
      ></span>
      Party unknown
    </li>
  </ul>

  <p
    id={instructionsId}
    class="interaction-hint"
  >
    Select a dot for details. With the chart
    focused, use the arrow keys to move between
    legislators and Enter to open a profile.
  </p>

  <!-- svelte-ignore a11y_no_noninteractive_element_interactions, a11y_no_noninteractive_tabindex -->
  <div
    bind:this={chartHost}
    class:busy={layoutBusy}
    class="chart-viewport"
    style={`height:${chartHeight}px`}
    tabindex="0"
    role="application"
    aria-label="Interactive chamber view of legislators"
    aria-describedby={`${captionId} ${summaryId} ${instructionsId}`}
    aria-busy={layoutBusy}
    onpointermove={handlePointerMove}
    onpointerleave={handlePointerLeave}
    onclick={handleCanvasClick}
    onfocus={handleCanvasFocus}
    onkeydown={handleKeydown}
  >
    <canvas
      bind:this={canvas}
      aria-hidden="true"
    ></canvas>

    {#if chartWidth > 0}
      <svg
        class="chart-overlay"
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        aria-hidden="true"
      >
        <path
          class="chamber-rule outer-rule"
          d={arcPath(geometry.outerRadius)}
        ></path>

        <path
          class="chamber-rule inner-rule"
          d={arcPath(geometry.innerRadius)}
        ></path>

        {#if excludedRows.length}
          <text
            class="band-label"
            x="16"
            y="16"
          >
            Excluded by filters
          </text>
        {/if}

        {#if unscoredRows.length}
          <text
            class="band-label"
            x={geometry.excludedWidth
              ? geometry.excludedWidth + 18
              : 16}
            y="16"
          >
            Not on ideology axis
          </text>
        {/if}

        <text
          class="axis-label"
          x="14"
          y={chartHeight - 8}
          text-anchor="start"
        >
          More liberal
        </text>

        <text
          class="axis-label"
          x={chartWidth - 14}
          y={chartHeight - 8}
          text-anchor="end"
        >
          More conservative
        </text>

        {#if hoverPoint && !animating}
          <circle
            class="hover-ring"
            cx={hoverPoint.x}
            cy={hoverPoint.y}
            r={hoverPoint.r + 3.5}
          ></circle>
        {/if}

        {#if activePoint && !animating}
          <circle
            class="active-ring"
            cx={activePoint.x}
            cy={activePoint.y}
            r={activePoint.r + 5}
          ></circle>
        {/if}
      </svg>
    {/if}

    {#if hoverPoint && hoverRow && !animating}
      <div
        class="tooltip"
        style={tooltipStyle(hoverPoint)}
        role="tooltip"
      >
        <strong>{hoverRow.name}</strong>

        {#if hoverRow.handle}
          <span>@{hoverRow.handle}</span>
        {/if}

        <span>
          {partyLabel(hoverRow.party)} ·
          {locationLabel(hoverRow)}
        </span>

        <span>
          Ideology:
          {formatIdeology(hoverRow.ideology)}
        </span>

        <span>
          {formatNumber(hoverRow.postCount)}
          posts
        </span>
      </div>
    {/if}

    {#if activeRow}
      <aside
        class="selection-panel"
        aria-label="Selected legislator"
      >
        <div class="selection-heading">
          <div>
            <p class="selection-eyebrow">
              Selected legislator
            </p>

            <h3>{activeRow.name}</h3>
          </div>

          <button
            type="button"
            class="close-selection"
            aria-label="Close selected legislator details"
            onclick={() => setActive(null)}
          >
            ×
          </button>
        </div>

        {#if activeRow.handle}
          <p class="handle">
            @{activeRow.handle}
          </p>
        {/if}

        <dl>
          <div>
            <dt>Party</dt>
            <dd>{partyLabel(activeRow.party)}</dd>
          </div>

          <div>
            <dt>Office</dt>
            <dd>{locationLabel(activeRow)}</dd>
          </div>

          <div>
            <dt>Ideology</dt>
            <dd class="mono">
              {formatIdeology(activeRow.ideology)}
            </dd>
          </div>

          <div>
            <dt>Posts</dt>
            <dd class="mono">
              {formatNumber(activeRow.postCount)}
            </dd>
          </div>
        </dl>

        {#if profileHref(activeRow)}
          <a
            class="profile-link"
            href={profileHref(activeRow) ?? undefined}
          >
            Open full profile
          </a>
        {/if}
      </aside>
    {/if}

    {#if layoutBusy}
      <div
        class="loading-indicator"
        aria-hidden="true"
      >
        <span></span>
      </div>
    {/if}
  </div>

  <p
    id={liveId}
    class="visually-hidden"
    aria-live="polite"
    aria-atomic="true"
  >
    {activeAnnouncement}
  </p>

  <details
    class="table-details"
    bind:open={tableOpen}
  >
    <summary>
      View as table
      <span>
        {formatNumber(normalizedRows.length)}
        legislators
      </span>
    </summary>

    {#if tableOpen}
      <div class="table-content">
        <div class="table-toolbar">
          <p>
            Showing {formatNumber(tableStart)}–{formatNumber(tableEnd)}
            of {formatNumber(sortedTableRows.length)}
          </p>

          <div class="table-pagination">
            <button
              type="button"
              disabled={tablePage === 0}
              onclick={() => changeTablePage(-1)}
            >
              Previous
            </button>

            <span>
              Page {tablePage + 1} of
              {tablePageCount}
            </span>

            <button
              type="button"
              disabled={tablePage >= tablePageCount - 1}
              onclick={() => changeTablePage(1)}
            >
              Next
            </button>
          </div>
        </div>

        <div class="table-scroll">
          <table>
            <caption class="visually-hidden">
              Legislators displayed in the Chamber
              View, with party, state, chamber,
              ideology, post count, and filter
              status.
            </caption>

            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Party</th>
                <th scope="col">State</th>
                <th scope="col">Chamber</th>
                <th scope="col">Ideology</th>
                <th scope="col">Posts</th>

                {#if excludedRows.length}
                  <th scope="col">Status</th>
                {/if}
              </tr>
            </thead>

            <tbody>
              {#each visibleTableRows as legislator (legislator.key)}
                <tr>
                  <th scope="row">
                    {#if profileHref(legislator)}
                      <a
                        href={profileHref(legislator) ?? undefined}
                      >
                        {legislator.name}
                      </a>
                    {:else}
                      {legislator.name}
                    {/if}

                    {#if legislator.handle}
                      <span class="table-handle">
                        @{legislator.handle}
                      </span>
                    {/if}
                  </th>

                  <td>
                    <span class="party-cell">
                      <span
                        class:democratic={legislator.party === 'Democratic'}
                        class:republican={legislator.party === 'Republican'}
                        class:independent={legislator.party === 'Independent'}
                        class:unknown={legislator.party === null}
                        class="table-party-mark"
                        aria-hidden="true"
                      ></span>

                      <span>
                        {partyInitial(legislator.party)}
                        {partyLabel(legislator.party)}
                      </span>
                    </span>
                  </td>

                  <td>{legislator.state ?? '—'}</td>

                  <td>{legislator.chamber ?? '—'}</td>

                  <td class="mono">
                    {formatIdeology(legislator.ideology)}
                  </td>

                  <td class="mono numeric">
                    {formatNumber(legislator.postCount)}
                  </td>

                  {#if excludedRows.length}
                    <td>
                      {legislator.included
                        ? 'Included'
                        : 'Excluded by filters'}
                    </td>
                  {/if}
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    {/if}
  </details>
</figure>

<style>
  .chamber {
    min-width: 0;
    padding: 16px;
    margin: 0;
    color: var(--color-ink, #1a1917);
    background: var(--color-card, #fff);
    border: 1px solid var(--color-rule, #d9d2c1);
    border-radius: 6px;
  }

  figcaption {
    max-width: 880px;
  }

  .heading-row {
    display: flex;
    gap: 20px;
    align-items: start;
    justify-content: space-between;
  }

  .eyebrow,
  .selection-eyebrow {
    margin: 0 0 4px;
    color: var(--color-seal, #8a5a1a);
    font-size: 0.72rem;
    font-weight: 600;
    line-height: 1rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  h2 {
    margin: 0;
    font-size: clamp(
      1.35rem,
      1.18rem + 0.55vw,
      1.75rem
    );
    line-height: 1.2;
    letter-spacing: -0.01em;
  }

  .population-count {
    margin: 2px 0 0;
    color: var(--color-mute, #6b6659);
    font-family: var(
      --font-data,
      'JetBrains Mono',
      ui-monospace,
      monospace
    );
    font-size: 0.78rem;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .caption,
  .chart-summary {
    margin: 6px 0 0;
    color: var(--color-mute, #6b6659);
    font-size: 0.875rem;
    line-height: 1.4rem;
  }

  .chart-summary {
    max-width: 960px;
    font-size: 0.8rem;
    line-height: 1.25rem;
  }

  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 18px;
    padding: 12px 0 0;
    margin: 0;
    color: var(--color-mute, #6b6659);
    font-size: 0.75rem;
    line-height: 1rem;
    list-style: none;
  }

  .legend li {
    display: inline-flex;
    gap: 7px;
    align-items: center;
  }

  .legend-mark,
  .table-party-mark {
    display: inline-block;
    width: 9px;
    height: 9px;
    background: var(--color-mute-soft, #9c9787);
    flex: 0 0 auto;
  }

  .legend-mark.democratic,
  .table-party-mark.democratic {
    background: var(--color-ballot-blue, #274b6e);
    border-radius: 50%;
  }

  .legend-mark.republican,
  .table-party-mark.republican {
    background: var(--color-ballot-red, #a13530);
  }

  .legend-mark.independent,
  .table-party-mark.independent {
    background: var(--color-independent, #7a6a4a);
    transform: rotate(45deg);
  }

  .legend-mark.unknown,
  .table-party-mark.unknown {
    background: transparent;
    border: 1px solid var(--color-mute-soft, #9c9787);
    border-radius: 50%;
  }

  .interaction-hint {
    margin: 8px 0 10px;
    color: var(--color-mute-soft, #9c9787);
    font-size: 0.75rem;
    line-height: 1.1rem;
  }

  .chart-viewport {
    position: relative;
    min-width: 0;
    overflow: hidden;
    background: var(--color-card, #fff);
    border-block: 1px solid var(--color-rule, #d9d2c1);
    isolation: isolate;
  }

  .chart-viewport:focus-within {
    outline: 2px solid var(--color-seal, #8a5a1a);
    outline-offset: 2px;
  }

  canvas,
  .chart-overlay {
    position: absolute;
    inset: 0;
    display: block;
    width: 100%;
    height: 100%;
  }

  canvas {
    z-index: 1;
    outline: none;
    touch-action: manipulation;
  }

  .chart-overlay {
    z-index: 2;
    overflow: visible;
    pointer-events: none;
  }

  .chamber-rule {
    fill: none;
    stroke: var(--color-rule, #d9d2c1);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }

  .inner-rule {
    opacity: 0.55;
  }

  .axis-label,
  .band-label {
    fill: var(--color-mute, #6b6659);
    font-family: var(
      --font-data,
      'JetBrains Mono',
      ui-monospace,
      monospace
    );
    font-size: 11px;
    letter-spacing: 0.01em;
  }

  .band-label {
    fill: var(--color-mute-soft, #9c9787);
    font-size: 10px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .hover-ring,
  .active-ring {
    fill: none;
    vector-effect: non-scaling-stroke;
  }

  .hover-ring {
    stroke: var(--color-ink, #1a1917);
    stroke-width: 1;
  }

  .active-ring {
    stroke: var(--color-seal, #8a5a1a);
    stroke-width: 2;
  }

  .tooltip {
    position: absolute;
    z-index: 5;
    display: grid;
    width: 240px;
    max-width: calc(100% - 16px);
    gap: 2px;
    padding: 9px 10px;
    color: var(--color-ink, #1a1917);
    background: var(--color-card, #fff);
    border: 1px solid var(--color-rule, #d9d2c1);
    border-radius: 6px;
    box-shadow: 0 4px 16px rgb(26 25 23 / 8%);
    pointer-events: none;
  }

  .tooltip strong {
    overflow: hidden;
    font-size: 0.82rem;
    line-height: 1.15rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tooltip span {
    overflow: hidden;
    color: var(--color-mute, #6b6659);
    font-size: 0.72rem;
    line-height: 1rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .selection-panel {
    position: absolute;
    top: 14px;
    right: 14px;
    z-index: 6;
    width: min(260px, calc(100% - 28px));
    padding: 12px;
    background: var(--color-card, #fff);
    border: 1px solid var(--color-rule, #d9d2c1);
    border-radius: 6px;
    box-shadow: 0 4px 16px rgb(26 25 23 / 8%);
  }

  .selection-heading {
    display: flex;
    gap: 10px;
    align-items: start;
    justify-content: space-between;
  }

  .selection-panel h3 {
    margin: 0;
    font-size: 1rem;
    line-height: 1.3rem;
  }

  .close-selection {
    display: grid;
    width: 32px;
    height: 32px;
    padding: 0;
    place-items: center;
    color: var(--color-mute, #6b6659);
    font: inherit;
    font-size: 1.2rem;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 4px;
    cursor: pointer;
    flex: 0 0 auto;
  }

  .close-selection:hover {
    color: var(--color-ink, #1a1917);
    background: color-mix(
      in srgb,
      var(--color-rule, #d9d2c1) 35%,
      transparent
    );
  }

  .close-selection:focus-visible,
  .profile-link:focus-visible,
  .table-pagination button:focus-visible,
  summary:focus-visible,
  table a:focus-visible {
    outline: 2px solid var(--color-seal, #8a5a1a);
    outline-offset: 2px;
  }

  .handle {
    margin: 3px 0 10px;
    color: var(--color-mute, #6b6659);
    font-size: 0.78rem;
  }

  dl {
    display: grid;
    gap: 6px;
    margin: 0;
  }

  dl div {
    display: grid;
    grid-template-columns: 76px minmax(0, 1fr);
    gap: 8px;
  }

  dt,
  dd {
    margin: 0;
    font-size: 0.75rem;
    line-height: 1.1rem;
  }

  dt {
    color: var(--color-mute, #6b6659);
  }

  dd {
    overflow-wrap: anywhere;
  }

  .profile-link {
    display: inline-flex;
    margin-top: 12px;
    color: var(--color-seal, #8a5a1a);
    font-size: 0.78rem;
    font-weight: 600;
    text-underline-offset: 3px;
  }

  .loading-indicator {
    position: absolute;
    top: 0;
    right: 0;
    left: 0;
    z-index: 7;
    height: 2px;
    overflow: hidden;
    background: var(--color-rule, #d9d2c1);
  }

  .loading-indicator span {
    display: block;
    width: 34%;
    height: 100%;
    background: var(--color-seal, #8a5a1a);
    animation: chamber-progress 900ms ease-in-out infinite alternate;
  }

  .table-details {
    margin-top: 12px;
    border-top: 1px solid var(--color-rule, #d9d2c1);
  }

  summary {
    display: flex;
    gap: 12px;
    align-items: center;
    justify-content: space-between;
    min-height: 44px;
    padding: 10px 2px;
    color: var(--color-ink, #1a1917);
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
  }

  summary span {
    color: var(--color-mute, #6b6659);
    font-family: var(
      --font-data,
      'JetBrains Mono',
      ui-monospace,
      monospace
    );
    font-size: 0.72rem;
    font-weight: 400;
    font-variant-numeric: tabular-nums;
  }

  .table-content {
    padding-top: 4px;
  }

  .table-toolbar {
    display: flex;
    gap: 16px;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
  }

  .table-toolbar p,
  .table-pagination span {
    margin: 0;
    color: var(--color-mute, #6b6659);
    font-size: 0.75rem;
    line-height: 1rem;
  }

  .table-pagination {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .table-pagination button {
    min-height: 34px;
    padding: 5px 9px;
    color: var(--color-ink, #1a1917);
    font: inherit;
    font-size: 0.75rem;
    background: var(--color-card, #fff);
    border: 1px solid var(--color-rule, #d9d2c1);
    border-radius: 4px;
    cursor: pointer;
  }

  .table-pagination button:hover:not(:disabled) {
    border-color: var(--color-ink, #1a1917);
  }

  .table-pagination button:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }

  .table-scroll {
    overflow-x: auto;
    border: 1px solid var(--color-rule, #d9d2c1);
    border-radius: 6px;
  }

  table {
    width: 100%;
    min-width: 760px;
    border-collapse: collapse;
    font-size: 0.78rem;
    line-height: 1.15rem;
  }

  th,
  td {
    padding: 9px 10px;
    text-align: left;
    vertical-align: top;
    border-bottom: 1px solid var(--color-rule, #d9d2c1);
  }

  thead th {
    position: sticky;
    top: 0;
    z-index: 1;
    color: var(--color-mute, #6b6659);
    font-size: 0.69rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    background: var(--color-card, #fff);
  }

  tbody tr:last-child th,
  tbody tr:last-child td {
    border-bottom: 0;
  }

  tbody tr:hover {
    background: color-mix(
      in srgb,
      var(--color-rule, #d9d2c1) 18%,
      transparent
    );
  }

  table a {
    color: var(--color-ink, #1a1917);
    text-underline-offset: 3px;
  }

  .table-handle {
    display: block;
    margin-top: 2px;
    color: var(--color-mute, #6b6659);
    font-size: 0.7rem;
    font-weight: 400;
  }

  .party-cell {
    display: inline-flex;
    gap: 7px;
    align-items: center;
  }

  .mono,
  .numeric {
    font-family: var(
      --font-data,
      'JetBrains Mono',
      ui-monospace,
      monospace
    );
    font-variant-numeric: tabular-nums;
  }

  .numeric {
    text-align: right;
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  @keyframes chamber-progress {
    from {
      transform: translateX(-10%);
    }

    to {
      transform: translateX(205%);
    }
  }

  @media (max-width: 720px) {
    .chamber {
      padding: 12px;
    }

    .heading-row {
      gap: 12px;
    }

    .interaction-hint {
      max-width: 34rem;
    }

    .selection-panel {
      top: auto;
      right: 10px;
      bottom: 10px;
      left: 10px;
      width: auto;
      max-height: 48%;
      overflow-y: auto;
    }

    .tooltip {
      display: none;
    }

    .table-toolbar {
      align-items: flex-start;
      flex-direction: column;
    }

    .table-pagination {
      width: 100%;
      justify-content: space-between;
    }
  }

  @media (max-width: 460px) {
    .population-count {
      display: none;
    }

    .legend {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px 12px;
    }

    .chart-summary {
      display: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .loading-indicator span {
      width: 100%;
      animation: none;
      transform: none;
    }

    .close-selection,
    .table-pagination button {
      transition: none;
    }
  }

  @media print {
    .interaction-hint,
    .tooltip,
    .selection-panel,
    .loading-indicator,
    .table-pagination {
      display: none;
    }

    .chamber {
      border-color: #aaa;
    }

    .chart-viewport {
      break-inside: avoid;
    }
  }
</style>
