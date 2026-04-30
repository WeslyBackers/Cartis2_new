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

-- Data for Name: tasks; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.tasks (id, task_number, title, description, production_line_id, baz_number, msi_active, needs_followup, needs_extra_info, caris_project_path, created_by, created_at, updated_at) VALUES (23, '260001', 'Gecombineerde taak: Kabellegging Scheur - Energiekabel Nederland-België, Nieuwe melding', NULL, 2, NULL, false, false, false, NULL, 4, '2026-03-12 13:01:45.561753', '2026-03-12 13:01:45.561753');
INSERT INTO public.tasks (id, task_number, title, description, production_line_id, baz_number, msi_active, needs_followup, needs_extra_info, caris_project_path, created_by, created_at, updated_at) VALUES (24, '260002', 'Gecombineerde taak: Kabellegging Scheur - Energiekabel Nederland-België, Nieuwe melding', NULL, 1, NULL, false, false, false, NULL, 4, '2026-03-12 16:27:48.030504', '2026-03-12 16:27:48.030504');
INSERT INTO public.tasks (id, task_number, title, description, production_line_id, baz_number, msi_active, needs_followup, needs_extra_info, caris_project_path, created_by, created_at, updated_at) VALUES (26, '260004', 'Tijdelijke havensluitingen Nieuwpoort wegens sluiswerkzaamheden', NULL, 2, NULL, false, false, false, NULL, 4, '2026-03-14 17:44:20.260883', '2026-04-04 12:51:36.004398');
INSERT INTO public.tasks (id, task_number, title, description, production_line_id, baz_number, msi_active, needs_followup, needs_extra_info, caris_project_path, created_by, created_at, updated_at) VALUES (27, '260005', 'VH_BackersW_20260401', NULL, 4, NULL, false, true, true, NULL, 4, '2026-04-04 13:09:20.59944', '2026-04-05 13:15:32.60305');
INSERT INTO public.tasks (id, task_number, title, description, production_line_id, baz_number, msi_active, needs_followup, needs_extra_info, caris_project_path, created_by, created_at, updated_at) VALUES (25, '260003', 'Drijvende constructie voor Blankenberge - nieuwe golfbreker', NULL, 2, NULL, false, false, true, NULL, 4, '2026-03-14 12:10:14.661504', '2026-04-23 18:48:21.178359');
INSERT INTO public.tasks (id, task_number, title, description, production_line_id, baz_number, msi_active, needs_followup, needs_extra_info, caris_project_path, created_by, created_at, updated_at) VALUES (28, '260006', 'Uitleggen boeien 14 en 13', NULL, 1, NULL, false, false, false, NULL, 4, '2026-04-24 13:59:33.923331', '2026-04-24 14:34:53.493653');
INSERT INTO public.tasks (id, task_number, title, description, production_line_id, baz_number, msi_active, needs_followup, needs_extra_info, caris_project_path, created_by, created_at, updated_at) VALUES (29, '260007', 'Nieuw ankergebied ''Oostdyck2''', NULL, 1, NULL, false, false, false, NULL, 6, '2026-04-26 12:32:07.489438', '2026-04-26 12:32:07.489438');
INSERT INTO public.tasks (id, task_number, title, description, production_line_id, baz_number, msi_active, needs_followup, needs_extra_info, caris_project_path, created_by, created_at, updated_at) VALUES (30, '260008', 'Nieuwe test melding', NULL, 2, NULL, false, false, false, NULL, 4, '2026-04-26 12:42:14.329176', '2026-04-26 12:42:14.329176');
INSERT INTO public.tasks (id, task_number, title, description, production_line_id, baz_number, msi_active, needs_followup, needs_extra_info, caris_project_path, created_by, created_at, updated_at) VALUES (31, '260009', 'RE: Extra gegevens Strekdam Blankenberge', NULL, 2, NULL, false, false, false, NULL, 4, '2026-04-30 09:04:56.594697', '2026-04-30 09:04:56.594697');


--
