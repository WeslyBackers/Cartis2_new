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

-- Data for Name: kml_files; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.kml_files (id, filename, filepath, category, display_name, description, production_line_id, imported_at, updated_at) VALUES (1, 'ENC_U3.kml', 'c:\Users\wesly\Downloads\Coverages\products\ENC_U3.kml', 'products', 'ENC U3', NULL, 2, '2026-02-26 09:37:30.723055', '2026-02-26 09:51:34.974265');
INSERT INTO public.kml_files (id, filename, filepath, category, display_name, description, production_line_id, imported_at, updated_at) VALUES (2, 'ENC_U4.kml', 'c:\Users\wesly\Downloads\Coverages\products\ENC_U4.kml', 'products', 'ENC U4', NULL, 2, '2026-02-26 09:37:30.723055', '2026-02-26 09:51:34.974265');
INSERT INTO public.kml_files (id, filename, filepath, category, display_name, description, production_line_id, imported_at, updated_at) VALUES (3, 'ENC_U5.kml', 'c:\Users\wesly\Downloads\Coverages\products\ENC_U5.kml', 'products', 'ENC U5', NULL, 2, '2026-02-26 09:37:30.723055', '2026-02-26 09:51:34.974265');
INSERT INTO public.kml_files (id, filename, filepath, category, display_name, description, production_line_id, imported_at, updated_at) VALUES (4, 'IENC.kml', 'c:\Users\wesly\Downloads\Coverages\products\IENC.kml', 'products', 'IENC', NULL, 2, '2026-02-26 09:37:30.723055', '2026-02-26 09:51:34.974265');
INSERT INTO public.kml_files (id, filename, filepath, category, display_name, description, production_line_id, imported_at, updated_at) VALUES (5, 'Pilot-ENC_U3.kml', 'c:\Users\wesly\Downloads\Coverages\products\Pilot-ENC_U3.kml', 'products', 'Pilot-ENC U3', NULL, 3, '2026-02-26 09:37:30.723055', '2026-02-26 09:51:34.974265');
INSERT INTO public.kml_files (id, filename, filepath, category, display_name, description, production_line_id, imported_at, updated_at) VALUES (6, 'Pilot-ENC_U4.kml', 'c:\Users\wesly\Downloads\Coverages\products\Pilot-ENC_U4.kml', 'products', 'Pilot-ENC U4', NULL, 3, '2026-02-26 09:37:30.723055', '2026-02-26 09:51:34.974265');
INSERT INTO public.kml_files (id, filename, filepath, category, display_name, description, production_line_id, imported_at, updated_at) VALUES (7, 'Pilot-ENC_U5.kml', 'c:\Users\wesly\Downloads\Coverages\products\Pilot-ENC_U5.kml', 'products', 'Pilot-ENC U5', NULL, 3, '2026-02-26 09:37:30.723055', '2026-02-26 09:51:34.974265');
INSERT INTO public.kml_files (id, filename, filepath, category, display_name, description, production_line_id, imported_at, updated_at) VALUES (8, 'Pilot-ENC_U6.kml', 'c:\Users\wesly\Downloads\Coverages\products\Pilot-ENC_U6.kml', 'products', 'Pilot-ENC U6', NULL, 3, '2026-02-26 09:37:30.723055', '2026-02-26 09:51:34.974265');
INSERT INTO public.kml_files (id, filename, filepath, category, display_name, description, production_line_id, imported_at, updated_at) VALUES (9, 'ZK_Officiele Zeekaarten.kml', 'c:\Users\wesly\Downloads\Coverages\products\ZK_Officiele Zeekaarten.kml', 'products', 'ZK Officiele Zeekaarten', NULL, 1, '2026-02-26 09:37:30.723055', '2026-02-26 09:51:34.974265');
INSERT INTO public.kml_files (id, filename, filepath, category, display_name, description, production_line_id, imported_at, updated_at) VALUES (10, 'ZK_Overzichtskaarten.kml', 'c:\Users\wesly\Downloads\Coverages\products\ZK_Overzichtskaarten.kml', 'products', 'ZK Overzichtskaarten', NULL, 1, '2026-02-26 09:37:30.723055', '2026-02-26 09:51:34.974265');
INSERT INTO public.kml_files (id, filename, filepath, category, display_name, description, production_line_id, imported_at, updated_at) VALUES (11, 'ZK_PapierenZeekaartensets.kml', 'c:\Users\wesly\Downloads\Coverages\products\ZK_PapierenZeekaartensets.kml', 'products', 'ZK PapierenZeekaartensets', NULL, 1, '2026-02-26 09:37:30.723055', '2026-02-26 09:51:34.974265');
INSERT INTO public.kml_files (id, filename, filepath, category, display_name, description, production_line_id, imported_at, updated_at) VALUES (12, 'Hoofdgebied_BE.kml', 'c:\Users\wesly\Downloads\Coverages\zones\Hoofdgebied_BE.kml', 'zones', 'Hoofdgebied BE', NULL, NULL, '2026-02-26 09:37:30.723055', '2026-02-26 09:51:34.974265');
INSERT INTO public.kml_files (id, filename, filepath, category, display_name, description, production_line_id, imported_at, updated_at) VALUES (13, 'Hoofdgebied_FR.kml', 'c:\Users\wesly\Downloads\Coverages\zones\Hoofdgebied_FR.kml', 'zones', 'Hoofdgebied FR', NULL, NULL, '2026-02-26 09:37:30.723055', '2026-02-26 09:51:34.974265');
INSERT INTO public.kml_files (id, filename, filepath, category, display_name, description, production_line_id, imported_at, updated_at) VALUES (14, 'Hoofdgebied_NL.kml', 'c:\Users\wesly\Downloads\Coverages\zones\Hoofdgebied_NL.kml', 'zones', 'Hoofdgebied NL', NULL, NULL, '2026-02-26 09:37:30.723055', '2026-02-26 09:51:34.974265');
INSERT INTO public.kml_files (id, filename, filepath, category, display_name, description, production_line_id, imported_at, updated_at) VALUES (15, 'Hoofdgebied_UK.kml', 'c:\Users\wesly\Downloads\Coverages\zones\Hoofdgebied_UK.kml', 'zones', 'Hoofdgebied UK', NULL, NULL, '2026-02-26 09:37:30.723055', '2026-02-26 09:51:34.974265');
INSERT INTO public.kml_files (id, filename, filepath, category, display_name, description, production_line_id, imported_at, updated_at) VALUES (16, 'KGBE.kml', 'c:\Users\wesly\Downloads\Coverages\zones\KGBE.kml', 'zones', 'KGBE', NULL, NULL, '2026-02-26 09:37:30.723055', '2026-02-26 09:51:34.974265');
INSERT INTO public.kml_files (id, filename, filepath, category, display_name, description, production_line_id, imported_at, updated_at) VALUES (17, 'KGFR.kml', 'c:\Users\wesly\Downloads\Coverages\zones\KGFR.kml', 'zones', 'KGFR', NULL, NULL, '2026-02-26 09:37:30.723055', '2026-02-26 09:51:34.974265');
INSERT INTO public.kml_files (id, filename, filepath, category, display_name, description, production_line_id, imported_at, updated_at) VALUES (18, 'KGNL.kml', 'c:\Users\wesly\Downloads\Coverages\zones\KGNL.kml', 'zones', 'KGNL', NULL, NULL, '2026-02-26 09:37:30.723055', '2026-02-26 09:51:34.974265');
INSERT INTO public.kml_files (id, filename, filepath, category, display_name, description, production_line_id, imported_at, updated_at) VALUES (19, 'KGT.kml', 'c:\Users\wesly\Downloads\Coverages\zones\KGT.kml', 'zones', 'KGT', NULL, NULL, '2026-02-26 09:37:30.723055', '2026-02-26 09:51:34.974265');
INSERT INTO public.kml_files (id, filename, filepath, category, display_name, description, production_line_id, imported_at, updated_at) VALUES (20, 'SCHE.kml', 'c:\Users\wesly\Downloads\Coverages\zones\SCHE.kml', 'zones', 'SCHE', NULL, NULL, '2026-02-26 09:37:30.723055', '2026-02-26 09:51:34.974265');
INSERT INTO public.kml_files (id, filename, filepath, category, display_name, description, production_line_id, imported_at, updated_at) VALUES (21, 'Subgebieden_BE.kml', 'c:\Users\wesly\Downloads\Coverages\zones\Subgebieden_BE.kml', 'zones', 'Subgebieden BE', NULL, NULL, '2026-02-26 09:37:30.723055', '2026-02-26 09:51:34.974265');
INSERT INTO public.kml_files (id, filename, filepath, category, display_name, description, production_line_id, imported_at, updated_at) VALUES (22, 'Zones_BE.kml', 'c:\Users\wesly\Downloads\Coverages\zones\Zones_BE.kml', 'zones', 'Zones BE', NULL, NULL, '2026-02-26 09:37:30.723055', '2026-02-26 09:51:34.974265');
INSERT INTO public.kml_files (id, filename, filepath, category, display_name, description, production_line_id, imported_at, updated_at) VALUES (23, 'Zones_FR.kml', 'c:\Users\wesly\Downloads\Coverages\zones\Zones_FR.kml', 'zones', 'Zones FR', NULL, NULL, '2026-02-26 09:37:30.723055', '2026-02-26 09:51:34.974265');
INSERT INTO public.kml_files (id, filename, filepath, category, display_name, description, production_line_id, imported_at, updated_at) VALUES (24, 'Zones_NL.kml', 'c:\Users\wesly\Downloads\Coverages\zones\Zones_NL.kml', 'zones', 'Zones NL', NULL, NULL, '2026-02-26 09:37:30.723055', '2026-02-26 09:51:34.974265');
INSERT INTO public.kml_files (id, filename, filepath, category, display_name, description, production_line_id, imported_at, updated_at) VALUES (25, 'Zones_UK.kml', 'c:\Users\wesly\Downloads\Coverages\zones\Zones_UK.kml', 'zones', 'Zones UK', NULL, NULL, '2026-02-26 09:37:30.723055', '2026-02-26 09:51:34.974265');


--
