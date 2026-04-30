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

-- Data for Name: production_lines; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.production_lines (id, code, name, description, is_active, created_at, updated_at) VALUES (1, 'ZK', 'Zeekaartproductie', 'Elektronische en papieren nautische kaarten', true, '2026-01-17 15:06:25.404842', '2026-01-17 15:06:25.404842');
INSERT INTO public.production_lines (id, code, name, description, is_active, created_at, updated_at) VALUES (2, 'IENC', 'Inland ENC', 'Binnenvaartkaarten', true, '2026-01-17 15:06:25.404842', '2026-01-17 15:06:25.404842');
INSERT INTO public.production_lines (id, code, name, description, is_active, created_at, updated_at) VALUES (3, 'PILOT_ENC', 'Pilot ENC', 'Gedetailleerde bathymetrische loodskaarten', true, '2026-01-17 15:06:25.404842', '2026-01-17 15:06:25.404842');
INSERT INTO public.production_lines (id, code, name, description, is_active, created_at, updated_at) VALUES (4, 'PUBL', 'Publicaties', 'Berichten aan Zeevarenden, Lichtenlijst, Verbeterlijst', true, '2026-01-17 15:06:25.404842', '2026-01-17 15:06:25.404842');


--
