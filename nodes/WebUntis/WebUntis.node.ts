/* eslint-disable n8n-nodes-base/node-param-resource-with-plural-option */
import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeConnectionType,
	NodeOperationError,
} from 'n8n-workflow';

import { getInfo, getData } from '../../lib/untis';
import moment from 'moment-timezone';

export class WebUntis implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'WebUntis',
		name: 'webUntis',
		icon: 'file:untis.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Gathers WebUntis data',
		defaults: {
			name: 'WebUntis',
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		credentials: [
			{
				name: 'webUntisApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Timetable',
						value: 'timetable',
					},
					{
						name: 'Teachers',
						value: 'teachers',
					},
					{
						name: 'Rooms',
						value: 'rooms',
					},
					{
						name: 'Subjects',
						value: 'subjects',
					},
				],
				default: 'timetable',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['timetable'],
					},
				},
				options: [
					{
						name: 'Get Week',
						value: 'getWeek',
						description: 'Get timetable for two weeks',
						action: 'Get timetable for two weeks',
					},
					{
						name: 'Get Timeframe',
						value: 'getTimeframe',
						description: 'Get timetable for many weeks',
						action: 'Get timetable for timeframe',
					},
				],
				default: 'getWeek',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['teachers', 'rooms', 'subjects'],
					},
				},
				options: [
					{
						name: 'Get Many',
						value: 'getMany',
						description: 'Get all items',
						action: 'Get all items',
					},
				],
				default: 'getMany',
			},
			{
				displayName: 'Date',
				name: 'date',
				type: 'dateTime',
				displayOptions: {
					show: {
						resource: ['timetable'],
					},
				},
				default: '',
				description: 'The date for which to retrieve the timetable (YYYY-MM-DD format)',
			},
			{
				displayName: 'Look Ahead Weeks',
				name: 'lookAhead',
				type: 'number',
				displayOptions: {
					show: {
						resource: ['timetable'],
						operation: ['getTimeframe'],
					},
				},
				default: 1,
				description: 'Number of weeks to look ahead from the specified date',
			},
			{
				displayName: 'School Name',
				name: 'schoolName',
				type: 'string',
				default: '',
				required: true,
				description: 'Name of the school in untis notation',
			},
			{
				displayName: 'Base URL',
				name: 'baseURL',
				type: 'string',
				required: true,
				default: '',
				description: 'Base URL of the WebUntis instance',
			},
		],
	};
	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;

		const credentials = await this.getCredentials('webUntisApi');
		const username = credentials.username as string;
		const password = credentials.password as string;

		const schoolName = this.getNodeParameter('schoolName', 0) as string;
		const baseURL = this.getNodeParameter('baseURL', 0) as string;
		try {
			const authData = await getInfo(username, password, schoolName, baseURL);
			const { sessionID, userID, holidays } = authData;
			for (let i = 0; i < items.length; i++) {
				let responseData: any;
				if (resource === 'timetable') {
					const date = this.getNodeParameter('date', i) as string;
					if (operation == 'getWeek') {
						responseData = await getData(date, 1, sessionID, userID, schoolName, holidays, baseURL);
                    } else if (operation == 'getTimeframe') {
                        const lookAhead = this.getNodeParameter('lookAhead', i) as number;
                        responseData = await getData(date, lookAhead, sessionID, userID, schoolName, holidays, baseURL);
                    }
                } else {
                    const sampleData = await getData(moment().format('YYYY-MM-DD'), 2, sessionID, userID, schoolName, holidays, baseURL);
					if (resource == 'teachers') {
						responseData = sampleData && sampleData.data ? sampleData.data.teachers : [];
					} else if (resource == 'rooms') {
						responseData = sampleData && sampleData.data ? sampleData.data.rooms : [];
					} else if (resource == 'subjects') {
						responseData = sampleData && sampleData.data ? sampleData.data.subjects : [];
					}
                }
                returnData.push({
                    json: responseData,
                });
			}
            return [returnData];
		} catch (error) {
            throw new NodeOperationError(this.getNode(), `WebUntis API Error: ${error}`);
        }
	}
}
