export const getDate = (): string => {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1; // Add 1 because months are zero indexed
  const day = now.getUTCDate();
  const formattedMonth = month < 10 ? `0${month}` : month;
  const formattedDay = day < 10 ? `0${day}` : day;
  const dateString = `${year}-${formattedMonth}-${formattedDay}`;

  return dateString;
};
