import moment from "moment-timezone";

export const convertToUntisDate = (dateObject: Date) => {
  const year = dateObject.getFullYear();
  const month = (dateObject.getMonth() + 1).toString().padStart(2, "0"); // Adding 1 to the month since months are zero-indexed
  const day = dateObject.getDate().toString().padStart(2, "0");

  return `${year}-${month}-${day}`;
};

export const isEarlier = (a: moment.MomentInput, b: moment.MomentInput) => {
    const format = "HH:mm";
    const dateA = moment(a, format);
    const dateB = moment(b, format);
    return dateA.isBefore(dateB);
}
export const isLater = (a: moment.MomentInput, b: moment.MomentInput) => {
    const format = "HH:mm";
    const dateA = moment(a, format);
    const dateB = moment(b, format);
    return dateA.isAfter(dateB);
}


export const isInHoliday = (date: string, holidays: any[] | undefined) => {
  if (holidays == undefined) {
    throw new Error("Error in isInHoliday: holidays is undefined");
  }
 return holidays.find((o: { start: moment.MomentInput; end: moment.MomentInput; })=>moment(o.start).isBefore(moment(date,"DD.MM.YYYY")) && moment(o.end).isAfter(moment(date,"DD.MM.YYYY")))
}