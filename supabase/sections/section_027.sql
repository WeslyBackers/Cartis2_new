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

-- Data for Name: user_notes; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.user_notes (id, content, created_by, created_at, updated_at, priority) VALUES (1, '<p><strong>Testnota</strong> via dashboard API</p>', 6, '2026-04-26 15:03:57.572263', '2026-04-26 15:03:57.572263', 'gemiddeld');
INSERT INTO public.user_notes (id, content, created_by, created_at, updated_at, priority) VALUES (4, '<p><strong>Edited note content</strong></p>', 6, '2026-04-26 15:07:30.255739', '2026-04-26 15:07:30.267284', 'gemiddeld');
INSERT INTO public.user_notes (id, content, created_by, created_at, updated_at, priority) VALUES (5, '<p>Edit keep lines</p>', 6, '2026-04-26 15:07:55.877768', '2026-04-26 15:07:55.877768', 'gemiddeld');
INSERT INTO public.user_notes (id, content, created_by, created_at, updated_at, priority) VALUES (7, '<p>Per-line visibility test</p>', 6, '2026-04-26 15:16:01.765778', '2026-04-26 15:16:01.765778', 'gemiddeld');
INSERT INTO public.user_notes (id, content, created_by, created_at, updated_at, priority) VALUES (2, '<p>test notitie</p>', 4, '2026-04-26 15:04:49.229623', '2026-04-27 18:34:41.923006', 'hoog');
INSERT INTO public.user_notes (id, content, created_by, created_at, updated_at, priority) VALUES (8, '<p>Een notitie met gemiddelde prioriteit</p>', 4, '2026-04-27 18:40:11.510414', '2026-04-27 18:40:11.510414', 'gemiddeld');
INSERT INTO public.user_notes (id, content, created_by, created_at, updated_at, priority) VALUES (9, '<p>Eerst S-57 product maken vooraleer S-101 product te produceren</p>', 4, '2026-04-28 15:31:11.798462', '2026-04-28 15:31:11.798462', 'hoog');


--
