--
-- PostgreSQL database dump
--


-- Dumped from database version 18.1
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--

-- Data for Name: notification_decisions; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.notification_decisions (id, notification_id, production_line_id, decision, decided_by, decided_at, notes, created_at, updated_at) VALUES (1, 10, 1, 'Nee', 4, '2026-01-17 19:30:20.151949', NULL, '2026-01-17 19:30:20.151949', '2026-01-17 19:30:20.151949');
INSERT INTO public.notification_decisions (id, notification_id, production_line_id, decision, decided_by, decided_at, notes, created_at, updated_at) VALUES (2, 8, 1, 'Ja', 4, '2026-01-17 19:30:47.21919', NULL, '2026-01-17 19:30:47.21919', '2026-01-17 19:30:47.21919');
INSERT INTO public.notification_decisions (id, notification_id, production_line_id, decision, decided_by, decided_at, notes, created_at, updated_at) VALUES (3, 10, 2, 'Ja', 4, '2026-01-17 19:31:02.348349', NULL, '2026-01-17 19:31:02.348349', '2026-01-17 19:31:02.348349');
INSERT INTO public.notification_decisions (id, notification_id, production_line_id, decision, decided_by, decided_at, notes, created_at, updated_at) VALUES (4, 8, 2, 'Nee', 4, '2026-01-29 10:55:51.104731', NULL, '2026-01-29 10:55:51.104731', '2026-01-29 10:55:51.104731');
INSERT INTO public.notification_decisions (id, notification_id, production_line_id, decision, decided_by, decided_at, notes, created_at, updated_at) VALUES (5, 7, NULL, 'Ja', 4, '2026-01-30 08:58:46.378295', '<p>test</p>', '2026-01-30 08:58:46.378295', '2026-01-30 08:58:46.378295');
INSERT INTO public.notification_decisions (id, notification_id, production_line_id, decision, decided_by, decided_at, notes, created_at, updated_at) VALUES (6, 5, NULL, 'Ja', 4, '2026-01-30 09:10:46.902528', '<p>test</p><p><br></p>', '2026-01-30 09:10:46.902528', '2026-01-30 09:10:46.902528');
INSERT INTO public.notification_decisions (id, notification_id, production_line_id, decision, decided_by, decided_at, notes, created_at, updated_at) VALUES (7, 7, NULL, NULL, 4, NULL, '<p>test opmerking</p>', '2026-01-30 09:19:58.334034', '2026-01-30 09:19:58.334034');
INSERT INTO public.notification_decisions (id, notification_id, production_line_id, decision, decided_by, decided_at, notes, created_at, updated_at) VALUES (8, 2, NULL, NULL, 4, NULL, '<p>testopmerking</p>', '2026-01-30 09:20:25.086499', '2026-01-30 09:20:25.086499');
INSERT INTO public.notification_decisions (id, notification_id, production_line_id, decision, decided_by, decided_at, notes, created_at, updated_at) VALUES (9, 9, 3, NULL, 4, NULL, '<p>dit is een test opmerking</p>', '2026-01-30 09:24:32.375612', '2026-01-30 09:24:32.375612');
INSERT INTO public.notification_decisions (id, notification_id, production_line_id, decision, decided_by, decided_at, notes, created_at, updated_at) VALUES (10, 5, 2, 'Ja', 4, '2026-02-22 11:18:01.312084', NULL, '2026-02-22 11:18:01.312084', '2026-02-22 11:18:01.312084');
INSERT INTO public.notification_decisions (id, notification_id, production_line_id, decision, decided_by, decided_at, notes, created_at, updated_at) VALUES (11, 7, 2, 'Ja', 4, '2026-02-22 11:18:01.310965', NULL, '2026-02-22 11:18:01.310965', '2026-02-22 11:18:01.310965');
INSERT INTO public.notification_decisions (id, notification_id, production_line_id, decision, decided_by, decided_at, notes, created_at, updated_at) VALUES (12, 11, 2, 'Ja', 4, '2026-02-25 19:04:26.662226', NULL, '2026-02-25 19:04:26.662226', '2026-02-25 19:04:26.662226');
INSERT INTO public.notification_decisions (id, notification_id, production_line_id, decision, decided_by, decided_at, notes, created_at, updated_at) VALUES (13, 12, 2, 'Ja', 4, '2026-02-25 19:04:26.972164', NULL, '2026-02-25 19:04:26.972164', '2026-02-25 19:04:26.972164');
INSERT INTO public.notification_decisions (id, notification_id, production_line_id, decision, decided_by, decided_at, notes, created_at, updated_at) VALUES (14, 3, 2, 'Ja', 4, '2026-02-25 19:15:29.291108', NULL, '2026-02-25 19:15:29.291108', '2026-02-25 19:15:29.291108');
INSERT INTO public.notification_decisions (id, notification_id, production_line_id, decision, decided_by, decided_at, notes, created_at, updated_at) VALUES (15, 1, 2, 'Ja', 4, '2026-02-25 19:15:56.201248', NULL, '2026-02-25 19:15:56.201248', '2026-02-25 19:15:56.201248');
INSERT INTO public.notification_decisions (id, notification_id, production_line_id, decision, decided_by, decided_at, notes, created_at, updated_at) VALUES (16, 6, 2, 'Ja', 4, '2026-02-25 19:15:56.216114', NULL, '2026-02-25 19:15:56.216114', '2026-02-25 19:15:56.216114');
INSERT INTO public.notification_decisions (id, notification_id, production_line_id, decision, decided_by, decided_at, notes, created_at, updated_at) VALUES (17, 2, 2, 'Ja', 4, '2026-02-25 19:18:16.127824', NULL, '2026-02-25 19:18:16.127824', '2026-02-25 19:18:16.127824');
INSERT INTO public.notification_decisions (id, notification_id, production_line_id, decision, decided_by, decided_at, notes, created_at, updated_at) VALUES (18, 9, 2, 'Ja', 4, '2026-02-25 19:18:24.066282', NULL, '2026-02-25 19:18:24.066282', '2026-02-25 19:18:24.066282');
INSERT INTO public.notification_decisions (id, notification_id, production_line_id, decision, decided_by, decided_at, notes, created_at, updated_at) VALUES (19, 4, 2, 'Ja', 4, '2026-02-25 19:18:27.276214', NULL, '2026-02-25 19:18:27.276214', '2026-02-25 19:18:27.276214');
INSERT INTO public.notification_decisions (id, notification_id, production_line_id, decision, decided_by, decided_at, notes, created_at, updated_at) VALUES (20, 15, 3, 'Ja', 4, '2026-02-28 09:45:10.686918', NULL, '2026-02-28 09:45:10.686918', '2026-02-28 09:45:10.686918');
INSERT INTO public.notification_decisions (id, notification_id, production_line_id, decision, decided_by, decided_at, notes, created_at, updated_at) VALUES (21, 12, 3, 'Ja', 4, '2026-02-28 09:46:08.545401', NULL, '2026-02-28 09:46:08.545401', '2026-02-28 09:46:08.545401');
INSERT INTO public.notification_decisions (id, notification_id, production_line_id, decision, decided_by, decided_at, notes, created_at, updated_at) VALUES (22, 15, 2, 'Ja', 4, '2026-02-28 10:09:50.54447', NULL, '2026-02-28 10:09:50.54447', '2026-02-28 10:09:50.54447');
INSERT INTO public.notification_decisions (id, notification_id, production_line_id, decision, decided_by, decided_at, notes, created_at, updated_at) VALUES (23, 14, 2, 'Ja', 4, '2026-02-28 11:06:37.049702', NULL, '2026-02-28 11:06:37.049702', '2026-02-28 11:06:37.049702');
INSERT INTO public.notification_decisions (id, notification_id, production_line_id, decision, decided_by, decided_at, notes, created_at, updated_at) VALUES (24, 13, 2, 'Ja', 4, '2026-02-28 11:11:41.991505', NULL, '2026-02-28 11:11:41.991505', '2026-02-28 11:11:41.991505');
INSERT INTO public.notification_decisions (id, notification_id, production_line_id, decision, decided_by, decided_at, notes, created_at, updated_at) VALUES (25, 15, 1, 'Ja', 4, '2026-02-28 11:14:00.834865', NULL, '2026-02-28 11:14:00.834865', '2026-02-28 11:14:00.834865');
INSERT INTO public.notification_decisions (id, notification_id, production_line_id, decision, decided_by, decided_at, notes, created_at, updated_at) VALUES (26, 16, 1, 'Ja', 4, '2026-02-28 11:15:48.85162', NULL, '2026-02-28 11:15:48.85162', '2026-02-28 11:15:48.85162');
INSERT INTO public.notification_decisions (id, notification_id, production_line_id, decision, decided_by, decided_at, notes, created_at, updated_at) VALUES (27, 16, 2, 'Ja', 4, '2026-02-28 11:16:41.639396', NULL, '2026-02-28 11:16:41.639396', '2026-02-28 11:16:41.639396');
INSERT INTO public.notification_decisions (id, notification_id, production_line_id, decision, decided_by, decided_at, notes, created_at, updated_at) VALUES (28, 16, 3, 'Ja', 4, '2026-02-28 11:25:31.256458', NULL, '2026-02-28 11:25:31.256458', '2026-02-28 11:25:31.256458');
INSERT INTO public.notification_decisions (id, notification_id, production_line_id, decision, decided_by, decided_at, notes, created_at, updated_at) VALUES (29, 59, 2, 'Ja', 4, '2026-03-12 13:01:45.510736', NULL, '2026-03-12 13:01:45.510736', '2026-03-12 13:01:45.510736');
INSERT INTO public.notification_decisions (id, notification_id, production_line_id, decision, decided_by, decided_at, notes, created_at, updated_at) VALUES (30, 58, 2, 'Ja', 4, '2026-03-12 13:01:45.530261', NULL, '2026-03-12 13:01:45.530261', '2026-03-12 13:01:45.530261');
INSERT INTO public.notification_decisions (id, notification_id, production_line_id, decision, decided_by, decided_at, notes, created_at, updated_at) VALUES (31, 59, 1, 'Ja', 4, '2026-03-12 16:27:47.987494', NULL, '2026-03-12 16:27:47.987494', '2026-03-12 16:27:47.987494');
INSERT INTO public.notification_decisions (id, notification_id, production_line_id, decision, decided_by, decided_at, notes, created_at, updated_at) VALUES (32, 58, 1, 'Ja', 4, '2026-03-12 16:27:48.004457', NULL, '2026-03-12 16:27:48.004457', '2026-03-12 16:27:48.004457');
INSERT INTO public.notification_decisions (id, notification_id, production_line_id, decision, decided_by, decided_at, notes, created_at, updated_at) VALUES (33, 56, 2, 'Ja', 4, '2026-03-14 12:10:14.637932', NULL, '2026-03-14 12:10:14.637932', '2026-03-14 12:10:14.637932');
INSERT INTO public.notification_decisions (id, notification_id, production_line_id, decision, decided_by, decided_at, notes, created_at, updated_at) VALUES (34, 56, 1, 'Ja', 4, '2026-03-14 12:16:36.007873', NULL, '2026-03-14 12:16:36.007873', '2026-03-14 12:16:36.007873');
INSERT INTO public.notification_decisions (id, notification_id, production_line_id, decision, decided_by, decided_at, notes, created_at, updated_at) VALUES (35, 55, 2, 'Ja', 4, '2026-03-14 17:44:20.230233', NULL, '2026-03-14 17:44:20.230233', '2026-03-14 17:44:20.230233');
INSERT INTO public.notification_decisions (id, notification_id, production_line_id, decision, decided_by, decided_at, notes, created_at, updated_at) VALUES (36, 60, 4, 'Ja', 4, '2026-04-04 13:09:20.577273', NULL, '2026-04-04 13:09:20.577273', '2026-04-04 13:09:20.577273');
INSERT INTO public.notification_decisions (id, notification_id, production_line_id, decision, decided_by, decided_at, notes, created_at, updated_at) VALUES (37, 60, 2, 'Ja', 4, '2026-04-04 14:38:09.273595', NULL, '2026-04-04 14:38:09.273595', '2026-04-04 14:38:09.273595');
INSERT INTO public.notification_decisions (id, notification_id, production_line_id, decision, decided_by, decided_at, notes, created_at, updated_at) VALUES (39, 54, 2, 'Nee', 4, '2026-04-24 10:30:15.309378', '<p>Geen verwerking nodig: ligt buiten de kaarten</p>', '2026-04-24 10:30:15.309378', '2026-04-24 10:30:15.309378');
INSERT INTO public.notification_decisions (id, notification_id, production_line_id, decision, decided_by, decided_at, notes, created_at, updated_at) VALUES (38, 57, 2, 'Nee', 4, '2026-04-24 10:30:15.308363', '<p>Geen verwerking nodig: ligt buiten de kaarten</p>', '2026-04-24 10:30:15.308363', '2026-04-24 10:30:15.308363');
INSERT INTO public.notification_decisions (id, notification_id, production_line_id, decision, decided_by, decided_at, notes, created_at, updated_at) VALUES (40, 53, 2, 'Nee', 4, '2026-04-24 13:25:47.500942', '<p>Valt niet op IENC kaart</p>', '2026-04-24 13:25:47.500942', '2026-04-24 13:25:47.500942');
INSERT INTO public.notification_decisions (id, notification_id, production_line_id, decision, decided_by, decided_at, notes, created_at, updated_at) VALUES (41, 49, 2, 'Nee', 4, '2026-04-24 13:25:47.761895', '<p>Valt niet op IENC kaart</p>', '2026-04-24 13:25:47.761895', '2026-04-24 13:25:47.761895');
INSERT INTO public.notification_decisions (id, notification_id, production_line_id, decision, decided_by, decided_at, notes, created_at, updated_at) VALUES (42, 62, 1, 'Ja', 4, '2026-04-24 13:59:33.891493', NULL, '2026-04-24 13:59:33.891493', '2026-04-24 13:59:33.891493');
INSERT INTO public.notification_decisions (id, notification_id, production_line_id, decision, decided_by, decided_at, notes, created_at, updated_at) VALUES (43, 62, 2, 'Ja', 4, '2026-04-24 13:59:40.25807', NULL, '2026-04-24 13:59:40.25807', '2026-04-24 13:59:40.25807');
INSERT INTO public.notification_decisions (id, notification_id, production_line_id, decision, decided_by, decided_at, notes, created_at, updated_at) VALUES (44, 62, 3, 'Ja', 4, '2026-04-24 15:40:57.302117', NULL, '2026-04-24 15:40:57.302117', '2026-04-24 15:40:57.302117');
INSERT INTO public.notification_decisions (id, notification_id, production_line_id, decision, decided_by, decided_at, notes, created_at, updated_at) VALUES (45, 58, 3, 'Ja', 4, '2026-04-24 15:43:40.626977', NULL, '2026-04-24 15:43:40.626977', '2026-04-24 15:43:40.626977');
INSERT INTO public.notification_decisions (id, notification_id, production_line_id, decision, decided_by, decided_at, notes, created_at, updated_at) VALUES (46, 61, 1, 'Ja', 4, '2026-04-25 11:45:04.011653', NULL, '2026-04-25 11:45:04.011653', '2026-04-25 11:45:04.011653');
INSERT INTO public.notification_decisions (id, notification_id, production_line_id, decision, decided_by, decided_at, notes, created_at, updated_at) VALUES (47, 71, 2, 'Nee', 4, '2026-04-26 12:29:22.065663', NULL, '2026-04-26 12:29:22.065663', '2026-04-26 12:29:22.065663');
INSERT INTO public.notification_decisions (id, notification_id, production_line_id, decision, decided_by, decided_at, notes, created_at, updated_at) VALUES (48, 71, 1, 'Ja', 6, '2026-04-26 12:32:07.305962', 'verify task creation after fix', '2026-04-26 12:29:34.031166', '2026-04-26 12:29:34.031166');
INSERT INTO public.notification_decisions (id, notification_id, production_line_id, decision, decided_by, decided_at, notes, created_at, updated_at) VALUES (51, 72, 2, 'Ja', 4, '2026-04-26 12:42:14.061715', NULL, '2026-04-26 12:42:14.061715', '2026-04-26 12:42:14.061715');
INSERT INTO public.notification_decisions (id, notification_id, production_line_id, decision, decided_by, decided_at, notes, created_at, updated_at) VALUES (52, 61, 2, 'Ja', 4, '2026-04-26 15:23:42.318137', NULL, '2026-04-26 15:23:42.318137', '2026-04-26 15:23:42.318137');
INSERT INTO public.notification_decisions (id, notification_id, production_line_id, decision, decided_by, decided_at, notes, created_at, updated_at) VALUES (53, 60, 1, 'Ja', 4, '2026-04-29 09:20:15.103105', NULL, '2026-04-29 09:18:55.242579', '2026-04-29 09:18:55.242579');
INSERT INTO public.notification_decisions (id, notification_id, production_line_id, decision, decided_by, decided_at, notes, created_at, updated_at) VALUES (65, 76, 2, 'Ja', 4, '2026-04-30 09:04:56.406484', NULL, '2026-04-30 09:04:56.406484', '2026-04-30 09:04:56.406484');


--
