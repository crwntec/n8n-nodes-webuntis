import axios from 'axios';
import qs from 'qs';
import moment from 'moment-timezone';
import { convertToUntisDate, isInHoliday } from './util';
interface UntisInfoT {
	sessionID: string;
	userID: number;
	schoolID: string;
	allowedClass: number;
	currentSchoolYear: {
		dateRange: {
			start: string;
			end: string;
		};
		id: number;
		name: string;
		timeGrid: {
			schoolyearId: number;
			units: Array<any>;
		};
	};
	holidays: Array<any[]>;
}
interface RawUntisPeriod  {
	id: number;
	lessonId: number;
	lessonNumber: number;
	lessonCode: string;
	lessonText: string;
	periodText: string;
	hasPeriodText: boolean;
	periodInfo: string;
	periodAttachments: Array<{
		url: string;
		name: string;
	}>;
	substText: string;
	date: number;
	startTime: number;
	endTime: number;
	elements: Array<{
		type: 1 | 2 | 3 | 4;
		id: number;
		orgId: number;
		missing: boolean;
		state: string;
	}>;
	studentGroup: string;
	hasInfo: boolean;
	code: number;
	cellState: string;
	priority: number;
	is: {
		standard: boolean;
		event: boolean;
	};
	roomCapacity: number;
	studentCount: number;
};

interface RawUntisElement  {
	type: 1 | 2 | 3 | 4 | 5;
	id: number;
	name: string;
	longName?: string;
	displayname: string;
	alternatename?: string;
	canViewTimetable: boolean;
	roomCapacity: number;
	externKey?: string;
};

interface RawUntisDataT {
  noDetails: boolean;
  elementIds: number[];
  elementPeriods: {
    [id: string]: Array<RawUntisPeriod>;
  },
  elements: Array<RawUntisElement>;
}
interface UntisElement {
	id: number;
	name: string;
	longName?: string;
}
interface Lesson {
	id: number;
	startTime: string;
	endTime: string;
	date: string;
	teacher: string;
	substTeacher: string;
	subject: string;
	room: UntisElement;
	additionalInfo: string;
	isSubstitution: boolean;
	isTeams: boolean;
	isEva: boolean;
	isCancelled: boolean;
	isFree: boolean;
}
interface Block extends Lesson {
	isInHoliday: boolean;
}
export const makeRequest = (date: string, sessionID: any, userID: number, schoolID: any, baseURL: string) => {
	if (!userID || !sessionID) return;
	return axios.get(baseURL + '/WebUntis/api/public/timetable/weekly/data', {
		params: {
			elementType: 5,
			elementId: userID,
			date: date,
			formatId: 8,
		},
		headers: {
			Accept: 'application/json',
			Cookie: `JSESSIONID=${sessionID}; schoolname="${schoolID}"; `,
		},
		validateStatus: (status) => status < 500,
	});
};
export async function getInfo(
	username: string,
	password: string,
	schoolName: string,
	baseURL: string,
): Promise<UntisInfoT> {
	const data = qs.stringify({
		school: schoolName,
		j_username: username,
		j_password: password,
		token: '',
	});
	const loginResponse = await axios.post(baseURL + '/WebUntis/j_spring_security_check', data, {
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/x-www-form-urlencoded',
		},
	});
	const sessionID = loginResponse.headers['set-cookie']![0].split(';')[0].split('=')[1].trim();
	const schoolID = loginResponse.headers['set-cookie']![1].split(';')[0].split('=')[1].trim();
	const tokenResponse = await axios.get(baseURL + '/WebUntis/api/token/new', {
		headers: {
			Accept: 'application/json, text/plain, */*',
			cookie: `JSESSIONID=${sessionID}; schoolname=^^${schoolID}^^`,
		},
		withCredentials: true,
	});
	const token = tokenResponse.data;
	const appDataResponse = await axios.get(baseURL + '/WebUntis/api/rest/view/v1/app/data', {
		headers: {
			Accept: 'application/json, text/plain, */*',
			Authorization: `Bearer ${token}`,
		},
		withCredentials: true,
	});
	const userID = appDataResponse.data.user.person.id;
	const currentSchoolYear = appDataResponse.data.currentSchoolYear;
	const holidays = appDataResponse.data.holidays;

	const weekPageResponse = await axios.get(
		baseURL + '/WebUntis/api/public/timetable/weekly/pageconfig',
		{
			params: {
				type: 5,
				date: moment().format('YYYY-MM-DD'),
				isMyTimetableSelected: true,
			},
			headers: {
				Accept: 'application/json, text/plain, */*',
				Authorization: `Bearer ${token}`,
				cookie: `JSESSIONID=${sessionID}; schoolname=^^${schoolID}^^`,
			},
		},
	);
	const allowedClass = weekPageResponse.data.data.elements[0].klasseId;
	return {
		sessionID,
		userID,
		schoolID,
		allowedClass,
		currentSchoolYear,
		holidays,
	};
}
export const getTeachers = (data: RawUntisDataT) => {
	let teachers: UntisElement[] = [];
	data.elements
		.filter((e) => e.type === 2)
		.forEach((teacher) => {
			teachers.push({
				id: teacher.id,
				name: teacher.name,
			});
		});
	return teachers;
};
export const getRooms = (data: RawUntisDataT) => {
	let rooms: UntisElement[] = [];
	data.elements
		.filter((e) => e.type === 4)
		.forEach((room) => {
			rooms.push({
				id: room.id,
				name: room.name,
				longName: room.longName,
			});
		});
	return rooms;
};
export const getSubjects = (data: RawUntisDataT) => {
	let subjects: UntisElement[] = [];
	data.elements
		.filter((e) => e.type === 3)
		.forEach((subject) => {
			subjects.push({
				id: subject.id,
				name: subject.name,
				longName: subject.longName,
			});
		});
	return subjects;
};
function combineToBlocks(lessons: Lesson[], holidays: any): Block[] {
	let blockLessons: Block[] = [];
	lessons.forEach((lesson) => {
		if (blockLessons.find((l) => l.id == lesson.id && l.date == lesson.date)) return;
		const adjLesson = lessons.filter((l) => l.id == lesson.id && l.date == lesson.date)[1];
		if (!adjLesson) {
			blockLessons.push({...lesson, isInHoliday: isInHoliday(lesson.date, holidays)});
			return;
		}
		blockLessons.push({
			...lesson,
			id: lesson.id,
			startTime: lesson.startTime,
			endTime: adjLesson.endTime,
			isInHoliday: isInHoliday(lesson.date, holidays),
			isSubstitution: lesson.isSubstitution || adjLesson.isSubstitution,
			isCancelled:
				(lesson.isCancelled || adjLesson.isCancelled) && !isInHoliday(lesson.date, holidays),
			isFree: lesson.isFree || adjLesson.isFree,
		});
	});

	blockLessons.sort((a, b) => {
		const [dayA, monthA, yearA] = a.date.split('.');
		const dateA = new Date(`${monthA}/${dayA}/${yearA} ${a.startTime}`);

		const [dayB, monthB, yearB] = b.date.split('.');
		const dateB = new Date(`${monthB}/${dayB}/${yearB} ${b.startTime}`);

		return dateA.getTime() - dateB.getTime();
	});
	return blockLessons;
}

function getLessonsForWeek(data: RawUntisDataT): Lesson[] {
	let lessons: Lesson[] = [];
	let teachers = getTeachers(data);
	let rooms = getRooms(data);
	let subjects = getSubjects(data);
	const key = Object.keys(data.elementPeriods)[0];
	data.elementPeriods[key].forEach((lesson) => {
		const teacher = lesson.elements.find(
			(e) => e.type === 2 && (lesson.cellState == 'SUBSTITUTION' ? e.orgId !== 0 : true),
		);
		const room = lesson.elements.find((e) => e.type === 4);
		const subject = lesson.elements.find((e) => e.type === 3);
		lessons.push({
			id: lesson.lessonId,
			startTime:
				(lesson.startTime.toString().length == 3
					? '0' + lesson.startTime.toString().substring(0, 1)
					: '' + lesson.startTime.toString().substring(0, 2)) +
				':' +
				lesson.startTime.toString().substring(lesson.startTime.toString().length == 3 ? 1 : 2),
			endTime:
				(lesson.endTime.toString().length == 3
					? '0' + lesson.endTime.toString().substring(0, 1)
					: '' + lesson.endTime.toString().substring(0, 2)) +
				':' +
				lesson.endTime.toString().substring(lesson.endTime.toString().length == 3 ? 1 : 2),
			date:
				lesson.date.toString().substring(6) +
				'.' +
				lesson.date.toString().substring(4, 6) +
				'.' +
				lesson.date.toString().substring(0, 4),
			teacher: teacher
				? teachers.find((t) =>
						lesson.cellState === 'SUBSTITUTION' ? t.id === teacher.orgId : t.id === teacher.id,
					)?.name ?? 'Unbekannt'
				: 'Unbekannt',
			substTeacher:
				teacher && lesson.cellState === 'SUBSTITUTION'
					? teachers.find((t) => t.id === teacher.id)?.name ?? 'Unbekannt'
					: 'Unbekannt',
			subject: subject ? subjects.find((s) => s.id === subject.id)?.name ?? 'Unbekannt' : 'Unbekannt',
			room: subject ? rooms.find((r) => r.id === room?.id) ?? {id: -1, name: 'Unbekannt'} : {id: -1 , name: 'Unbekannt'},
			additionalInfo: lesson.periodText,
			isSubstitution:
				lesson.cellState === 'SUBSTITUTION' && teacher?.id !== 81 && teacher?.id !== 411,
			isTeams: lesson.cellState === 'SUBSTITUTION' && teacher?.id == 411,
			isEva: teacher ? teacher.id == 81 : false,
			isCancelled: lesson.cellState === 'CANCEL',
			isFree: lesson.cellState == 'FREE',
		});
	});
	return lessons;
}

export const getData = async (date: string, lookAhead: number, sessionID: string, userID: number, schoolID: string, holidays: any[][], baseURL: string) => {
	if (!sessionID) {
		throw new Error('No sessionID');
		return;
	}
	const startDate = new Date(date);
	let dates = [startDate];
	for (let i = 1; i <= lookAhead; i++) {
		let d = new Date(startDate);
		d.setDate(d.getDate() + i * 7);
		dates.push(d);
	}
	const untisDates = dates.map((d) => convertToUntisDate(d));
	const promises = untisDates.map((d) => makeRequest(d, sessionID, userID, schoolID, baseURL)).filter((p): p is NonNullable<typeof p> => !!p);
	const responses = await axios.all(promises).catch((error) => {
		if (error.response) {
			// The request was made and the server responded with a status code
			// that falls out of the range of 2xx
			throw new Error("Error in getData: " + error.response.data);
		} else if (error.request) {
			// The request was made but no response was received
			// `error.request` is an instance of XMLHttpRequest in the browser and an instance of
			// http.ClientRequest in node.js
			throw new Error("Error in getData: " + error.request);
		} else {
			// Something happened in setting up the request that triggered an Error
			throw new Error("Error in getData: " + error.message);
		}
	});
	if (!responses) return { status: 500, data: null };
	if (responses.some((response) => response?.status === 403)) {
		return { status: responses[0]?.status, data: null };
	}
	const validResponses = responses.filter(
		(r) => r && r.data && r.data.data && r.data.data.result && r.data.data.result.data,
	);
	if (validResponses.length === 0) {
		return { status: 500, data: null };
	}
	let combinedLessons: any = validResponses.map((response) =>
		getLessonsForWeek(response.data.data.result.data),
	);
	combinedLessons = ([] as Lesson[]).concat(...combinedLessons);
	let filteredResponses = validResponses.filter(
		(r) => r.data.data.result.data.elements.length > 1,
	);
	if (filteredResponses.length == 0) {
		return { status: 500, data: null };
	}
	
	return {
		status: 200,
		data: {
			lessons: combineToBlocks(combinedLessons, holidays),
			teachers: getTeachers(
				{
					...filteredResponses[0].data.data.result.data,
					elements: filteredResponses
						.flatMap((r) => r.data.data.result.data.elements)
				}
			),
			rooms: getRooms(
				{
					...filteredResponses[0].data.data.result.data,
					elements: filteredResponses
						.flatMap((r) => r.data.data.result.data.elements)
				}
			),
			subjects: getSubjects(
				{
					...filteredResponses[0].data.data.result.data,
					elements: filteredResponses
						.flatMap((r) => r.data.data.result.data.elements)
				}
			),
		},
	};
};

