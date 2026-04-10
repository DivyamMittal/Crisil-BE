export const calculateElapsedWholeMinutes = (startTime: Date | string, endTime: Date | string) => {
  const startMs = new Date(startTime).getTime();
  const endMs = new Date(endTime).getTime();

  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return 0;
  }

  return Math.floor((endMs - startMs) / 60000);
};

export const calculateElapsedWholeSeconds = (startTime: Date | string, endTime: Date | string) => {
  const startMs = new Date(startTime).getTime();
  const endMs = new Date(endTime).getTime();

  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return 0;
  }

  return Math.floor((endMs - startMs) / 1000);
};
