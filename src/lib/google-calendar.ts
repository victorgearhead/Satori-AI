import { google } from 'googleapis';
import type { calendar_v3 } from 'googleapis';

interface CreateMeetEventInput {
  title: string;
  description?: string;
  startTimeIso: string;
  endTimeIso: string;
  timezone: string;
  attendeeEmails: string[];
}

interface CreateMeetEventOutput {
  meetLink: string;
  eventId: string;
}

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getCalendarAuth() {
  const clientEmail = getEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL');
  const privateKey = getEnv('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY').replace(/\\n/g, '\n');

  return new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/calendar'],
  });
}

export async function createGoogleMeetEvent(
  input: CreateMeetEventInput
): Promise<CreateMeetEventOutput> {
  const auth = getCalendarAuth();
  const calendar = google.calendar({ version: 'v3', auth });
  const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';

  const response = await calendar.events.insert({
    calendarId,
    conferenceDataVersion: 1,
    requestBody: {
      summary: input.title,
      description: input.description,
      start: {
        dateTime: input.startTimeIso,
        timeZone: input.timezone,
      },
      end: {
        dateTime: input.endTimeIso,
        timeZone: input.timezone,
      },
      attendees: input.attendeeEmails.map((email) => ({ email })),
      conferenceData: {
        createRequest: {
          requestId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          conferenceSolutionKey: {
            type: 'hangoutsMeet',
          },
        },
      },
    },
    sendUpdates: 'all',
  });

  const meetLink =
    response.data.hangoutLink ||
    response.data.conferenceData?.entryPoints?.find(
      (entry: calendar_v3.Schema$EntryPoint) => entry.entryPointType === 'video'
    )
      ?.uri;

  if (!response.data.id || !meetLink) {
    throw new Error('Google Calendar event created but Meet link was not returned.');
  }

  return {
    eventId: response.data.id,
    meetLink,
  };
}
