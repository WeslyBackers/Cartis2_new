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

-- Data for Name: notification_coordinates; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.notification_coordinates (id, notification_id, latitude, longitude, label, description, created_by, created_at, updated_at, geometry) VALUES (55, 58, 0.00000000, 0.00000000, NULL, NULL, 4, '2026-03-08 14:31:53.20475', '2026-03-08 14:31:53.20475', '{"type":"Point","coordinates":[3.288262,51.398213]}');
INSERT INTO public.notification_coordinates (id, notification_id, latitude, longitude, label, description, created_by, created_at, updated_at, geometry) VALUES (56, 57, 0.00000000, 0.00000000, NULL, NULL, 4, '2026-03-14 13:17:31.733272', '2026-03-14 13:17:31.733272', '{"type":"Point","coordinates":[3.1069,51.481523]}');
INSERT INTO public.notification_coordinates (id, notification_id, latitude, longitude, label, description, created_by, created_at, updated_at, geometry) VALUES (57, 60, 51.42000000, 3.26000000, NULL, NULL, 4, '2026-04-02 16:04:07.523233', '2026-04-02 16:05:17.889749', NULL);
INSERT INTO public.notification_coordinates (id, notification_id, latitude, longitude, label, description, created_by, created_at, updated_at, geometry) VALUES (64, 61, 0.00000000, 0.00000000, NULL, NULL, 4, '2026-04-07 16:47:26.512732', '2026-04-07 16:47:26.512732', '{"type":"Point","coordinates":[2.882538,51.290032]}');
INSERT INTO public.notification_coordinates (id, notification_id, latitude, longitude, label, description, created_by, created_at, updated_at, geometry) VALUES (65, 61, 0.00000000, 0.00000000, NULL, NULL, 4, '2026-04-07 16:47:38.906019', '2026-04-07 16:47:38.906019', '{"type":"Point","coordinates":[3.2341,51.396118]}');
INSERT INTO public.notification_coordinates (id, notification_id, latitude, longitude, label, description, created_by, created_at, updated_at, geometry) VALUES (66, 63, 0.00000000, 0.00000000, 'aKust33', NULL, 4, '2026-04-26 11:29:00.576686', '2026-04-26 11:29:55.293112', '{"type":"Point","coordinates":[3.16501,51.402258]}');


--
