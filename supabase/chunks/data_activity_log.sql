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
-- Data for Name: activity_log; Type: TABLE DATA; Schema: public; Owner: -
--

SET SESSION AUTHORIZATION DEFAULT;

ALTER TABLE public.activity_log DISABLE TRIGGER ALL;

INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (2, 'task', 1, 'created', NULL, 4, NULL, '2026-01-17 19:30:47.230983');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (4, 'task', 2, 'created', NULL, 4, NULL, '2026-01-17 19:31:02.362245');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (163, 'notification', 59, 'created', NULL, 4, NULL, '2026-03-12 12:55:47.78207');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (167, 'task_production_line_status', 1, 'status_updated', '{"status": "completed", "production_line_id": "2"}', 4, NULL, '2026-03-12 16:04:52.913021');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (173, 'task', 25, 'created', NULL, 4, NULL, '2026-03-14 12:10:14.673173');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (174, 'notification', 56, 'decided', '{"decision": "Ja", "productionLineId": 2}', 4, NULL, '2026-03-14 12:10:14.682665');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (176, 'task_production_line_status', 1, 'status_updated', '{"status": "under_construction", "production_line_id": "2"}', 4, NULL, '2026-03-14 13:10:44.231253');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (178, 'task', 26, 'created', NULL, 4, NULL, '2026-03-14 17:44:20.270472');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (179, 'notification', 55, 'decided', '{"decision": "Ja", "productionLineId": 2}', 4, NULL, '2026-03-14 17:44:20.282553');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (180, 'task_product', 49, 'created', '{"status": "hoog_te_verwerken", "taskId": "25", "productId": 56, "productionLineId": 2}', 4, NULL, '2026-03-27 15:25:02.13793');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (182, 'notification', 60, 'coordinate_added', '{"label": null, "latitude": 51.12, "longitude": 3.36}', 4, NULL, '2026-04-02 16:04:07.553325');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (183, 'notification', 60, 'coordinate_updated', '{"latitude": 51.22, "longitude": 3.36, "coordinateId": "57"}', 4, NULL, '2026-04-02 16:04:23.485788');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (16, 'task', 3, 'created', NULL, 4, NULL, '2026-01-30 08:58:46.394793');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (184, 'notification', 60, 'coordinate_updated', '{"latitude": 51.32, "longitude": 3.36, "coordinateId": "57"}', 4, NULL, '2026-04-02 16:04:41.871034');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (18, 'task', 4, 'created', NULL, 4, NULL, '2026-01-30 09:10:46.911221');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (185, 'notification', 60, 'coordinate_updated', '{"latitude": 51.42, "longitude": 3.36, "coordinateId": "57"}', 4, NULL, '2026-04-02 16:04:59.30179');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (186, 'notification', 60, 'coordinate_updated', '{"latitude": 51.42, "longitude": 3.26, "coordinateId": "57"}', 4, NULL, '2026-04-02 16:05:17.901307');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (188, 'notification', 60, 'coordinate_deleted', '{"coordinateId": "58"}', 4, NULL, '2026-04-02 16:10:27.913009');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (191, 'notification', 60, 'decided', '{"decision": "Ja", "productionLineId": 2}', 4, NULL, '2026-04-04 14:38:09.302909');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (193, 'notification', 60, 'coordinate_updated', '{"latitude": 51.363466, "longitude": 4.4, "coordinateId": "59"}', 4, NULL, '2026-04-04 17:00:14.977641');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (195, 'notification', 60, 'coordinate_deleted', '{"coordinateId": "59"}', 4, NULL, '2026-04-04 17:04:09.613912');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (198, 'notification', 60, 'coordinate_added', '{"label": null, "latitude": 27.891537, "longitude": -177.134268}', 4, NULL, '2026-04-04 17:14:09.363348');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (199, 'notification', 60, 'coordinate_updated', '{"latitude": 27.818051, "longitude": -177.134177, "coordinateId": "61"}', 4, NULL, '2026-04-04 17:14:28.574614');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (200, 'notification', 60, 'coordinate_updated', '{"latitude": 51.363443, "longitude": 3.189813, "coordinateId": "61"}', 4, NULL, '2026-04-04 17:14:51.224216');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (203, 'notification', 60, 'coordinate_added', '{"label": null, "latitude": 69.331902, "longitude": 2.380876}', 4, NULL, '2026-04-04 17:23:03.593261');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (207, 'notification', 61, 'created', NULL, 4, NULL, '2026-04-07 16:46:53.494026');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (210, 'notification', 62, 'created', NULL, 4, NULL, '2026-04-07 16:59:00.07175');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (211, 'notification', 62, 'attachment_added', '{"filename": "jbauer-fotographie-water-3840111_1920.jpg"}', 4, NULL, '2026-04-07 16:59:01.716872');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (212, 'notification', 54, 'decided', '{"decision": "Nee", "productionLineId": 2}', 4, NULL, '2026-04-24 10:30:15.325248');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (214, 'notification', 53, 'decided', '{"decision": "Nee", "productionLineId": 2}', 4, NULL, '2026-04-24 13:25:47.504996');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (215, 'notification', 49, 'decided', '{"decision": "Nee", "productionLineId": 2}', 4, NULL, '2026-04-24 13:25:47.763239');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (217, 'task_production_line_status', 11, 'wait_for_zk_updated', '{"wait_for_zk": false, "auto_completed": false, "production_line_id": "2"}', 4, NULL, '2026-04-24 13:49:34.407696');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (220, 'task', 28, 'created', NULL, 4, NULL, '2026-04-24 13:59:33.941864');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (221, 'notification', 62, 'decided', '{"decision": "Ja", "productionLineId": 1}', 4, NULL, '2026-04-24 13:59:33.948279');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (222, 'notification', 62, 'decided', '{"decision": "Ja", "productionLineId": 2}', 4, NULL, '2026-04-24 13:59:40.274957');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (223, 'task_production_line_status', 17, 'wait_for_zk_updated', '{"wait_for_zk": true, "auto_completed": false, "production_line_id": "2"}', 4, NULL, '2026-04-24 13:59:47.271265');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (225, 'task_production_line_status', 17, 'wait_for_zk_updated', '{"wait_for_zk": false, "auto_completed": false, "production_line_id": "2"}', 4, NULL, '2026-04-24 14:11:37.838686');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (226, 'task_production_line_status', 17, 'wait_for_zk_updated', '{"wait_for_zk": true, "auto_completed": false, "production_line_id": "2"}', 4, NULL, '2026-04-24 14:11:39.29719');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (227, 'notification', 62, 'decided', '{"decision": "Ja", "productionLineId": 3}', 4, NULL, '2026-04-24 15:40:58.041023');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (228, 'task_production_line_status', 22, 'wait_for_zk_updated', '{"wait_for_zk": true, "auto_completed": true, "production_line_id": "3"}', 4, NULL, '2026-04-24 15:41:03.256785');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (230, 'notification', 58, 'decided', '{"decision": "Ja", "productionLineId": 3}', 4, NULL, '2026-04-24 15:43:40.664922');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (231, 'task_production_line_status', 22, 'wait_for_zk_updated', '{"wait_for_zk": true, "auto_completed": false, "production_line_id": "3"}', 4, NULL, '2026-04-24 15:43:48.731596');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (233, 'product_version', 11, 'published', NULL, 4, NULL, '2026-04-24 16:25:57.641022');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (235, 'task_production_line_status', 10, 'status_updated', '{"status": "completed", "production_line_id": "4"}', 4, NULL, '2026-04-24 16:37:46.453123');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (237, 'task_product', 51, 'status_updated', '{"status": "voltooid"}', 4, NULL, '2026-04-24 16:50:36.152812');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (238, 'task_product', 51, 'execution_status_updated', '{"execution_status": "executed", "product_version_id": "21"}', 4, NULL, '2026-04-24 16:50:55.692515');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (239, 'product_version', 21, 'published', NULL, 4, NULL, '2026-04-24 16:51:16.113744');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (243, 'task_production_line_status', 11, 'wait_for_zk_updated', '{"wait_for_zk": true, "auto_completed": false, "production_line_id": "2"}', 4, NULL, '2026-04-24 18:42:14.37881');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (244, 'task_production_line_status', 11, 'wait_for_zk_updated', '{"wait_for_zk": false, "auto_completed": false, "production_line_id": "2"}', 4, NULL, '2026-04-24 18:42:15.33127');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (245, 'task_production_line_status', 11, 'wait_for_zk_updated', '{"wait_for_zk": true, "auto_completed": false, "production_line_id": "2"}', 4, NULL, '2026-04-24 18:42:16.036606');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (247, 'task_product', 52, 'status_updated', '{"status": "voltooid"}', 4, NULL, '2026-04-24 18:56:30.415356');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (248, 'task_product', 52, 'execution_status_updated', '{"execution_status": "executed", "product_version_id": "24"}', 4, NULL, '2026-04-24 18:56:50.166199');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (250, 'task_product', 42, 'execution_status_updated', '{"execution_status": "executed", "product_version_id": "24"}', 4, NULL, '2026-04-24 18:57:06.609606');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (251, 'product_version', 24, 'published', NULL, 4, NULL, '2026-04-24 18:57:13.810893');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (254, 'product_version', 23, 'attachment_added', '{"filename": "Goedkeuringsattest Inland ENC_BE7GT017_ed16.docx_signed_2026-04-22T15_06_00.pdf"}', 4, NULL, '2026-04-25 11:19:29.002622');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (256, 'notification', 61, 'decided', '{"decision": "Ja", "productionLineId": 1}', 4, NULL, '2026-04-25 11:45:04.053197');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (258, 'notification', 63, 'geometry_added', '{"label": null}', 4, NULL, '2026-04-26 11:29:00.593891');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (260, 'notification', 71, 'created', NULL, 4, NULL, '2026-04-26 12:11:01.533176');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (262, 'task', 29, 'created', NULL, 6, NULL, '2026-04-26 12:32:07.503857');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (263, 'notification', 71, 'decided', '{"decision": "Ja", "productionLineId": 1}', 6, NULL, '2026-04-26 12:32:07.511366');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (265, 'task', 30, 'created', NULL, 4, NULL, '2026-04-26 12:42:14.340256');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (66, 'task', 5, 'created', NULL, 4, NULL, '2026-02-22 11:18:01.33654');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (72, 'task', 7, 'created', NULL, 4, NULL, '2026-02-25 19:04:26.697669');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (74, 'task', 8, 'created', NULL, 4, NULL, '2026-02-25 19:04:26.976385');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (76, 'task', 9, 'created', NULL, 4, NULL, '2026-02-25 19:15:29.317911');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (162, 'notification', 58, 'geometry_added', '{"label": null}', 4, NULL, '2026-03-08 14:31:53.238778');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (164, 'notification', 59, 'decided', '{"decision": "Ja", "productionLineId": 2}', 4, NULL, '2026-03-12 13:01:45.528283');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (80, 'task', 10, 'created', NULL, 4, NULL, '2026-02-25 19:15:56.22323');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (81, 'task', 11, 'created', NULL, 4, NULL, '2026-02-25 19:18:16.154865');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (165, 'notification', 58, 'decided', '{"decision": "Ja", "productionLineId": 2}', 4, NULL, '2026-03-12 13:01:45.530948');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (83, 'task', 12, 'created', NULL, 4, NULL, '2026-02-25 19:18:24.070906');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (166, 'task', 23, 'created', NULL, 4, NULL, '2026-03-12 13:01:45.574955');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (85, 'task', 13, 'created', NULL, 4, NULL, '2026-02-25 19:18:27.280794');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (168, 'task_production_line_status', 1, 'status_updated', '{"status": "under_construction", "production_line_id": "2"}', 4, NULL, '2026-03-12 16:26:52.919503');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (169, 'task_production_line_status', 1, 'status_updated', '{"status": "completed", "production_line_id": "2"}', 4, NULL, '2026-03-12 16:26:58.588803');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (170, 'notification', 59, 'decided', '{"decision": "Ja", "productionLineId": 1}', 4, NULL, '2026-03-12 16:27:48.002399');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (171, 'notification', 58, 'decided', '{"decision": "Ja", "productionLineId": 1}', 4, NULL, '2026-03-12 16:27:48.005779');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (172, 'task', 24, 'created', NULL, 4, NULL, '2026-03-12 16:27:48.052493');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (175, 'notification', 56, 'decided', '{"decision": "Ja", "productionLineId": 1}', 4, NULL, '2026-03-14 12:16:36.050979');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (177, 'notification', 57, 'geometry_added', '{"label": null}', 4, NULL, '2026-03-14 13:17:31.765333');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (181, 'notification', 60, 'created', NULL, 4, NULL, '2026-04-01 20:04:35.283981');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (187, 'notification', 60, 'geometry_added', '{"label": null}', 4, NULL, '2026-04-02 16:09:50.623657');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (189, 'task', 27, 'created', NULL, 4, NULL, '2026-04-04 13:09:20.607992');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (190, 'notification', 60, 'decided', '{"decision": "Ja", "productionLineId": 4}', 4, NULL, '2026-04-04 13:09:20.618891');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (192, 'notification', 60, 'coordinate_added', '{"label": "test", "latitude": 51.119911, "longitude": 4.4}', 4, NULL, '2026-04-04 16:58:48.763412');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (194, 'notification', 60, 'coordinate_updated', '{"latitude": 51.371677, "longitude": 4.4, "coordinateId": "59"}', 4, NULL, '2026-04-04 17:01:14.860793');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (196, 'notification', 60, 'coordinate_added', '{"label": "test", "latitude": 51.344659, "longitude": 4.456}', 4, NULL, '2026-04-04 17:05:53.058057');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (197, 'notification', 60, 'coordinate_deleted', '{"coordinateId": "60"}', 4, NULL, '2026-04-04 17:06:07.431014');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (201, 'notification', 60, 'coordinate_added', '{"label": null, "latitude": 51.784033, "longitude": 3.156212}', 4, NULL, '2026-04-04 17:21:47.344678');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (202, 'notification', 60, 'coordinate_deleted', '{"coordinateId": "62"}', 4, NULL, '2026-04-04 17:22:00.670892');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (204, 'notification', 60, 'coordinate_updated', '{"latitude": 51.351447, "longitude": 3.167398, "coordinateId": "63"}', 4, NULL, '2026-04-04 17:23:47.143938');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (205, 'notification', 60, 'coordinate_deleted', '{"coordinateId": "63"}', 4, NULL, '2026-04-04 17:24:05.11647');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (206, 'notification', 60, 'coordinate_deleted', '{"coordinateId": "61"}', 4, NULL, '2026-04-04 17:24:09.314764');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (208, 'notification', 61, 'geometry_added', '{"label": null}', 4, NULL, '2026-04-07 16:47:26.525365');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (107, 'task', 14, 'created', NULL, 4, NULL, '2026-02-28 09:45:10.701799');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (209, 'notification', 61, 'geometry_added', '{"label": null}', 4, NULL, '2026-04-07 16:47:38.917133');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (109, 'task', 15, 'created', NULL, 4, NULL, '2026-02-28 09:46:08.584092');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (213, 'notification', 57, 'decided', '{"decision": "Nee", "productionLineId": 2}', 4, NULL, '2026-04-24 10:30:15.325539');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (111, 'task', 16, 'created', NULL, 4, NULL, '2026-02-28 10:09:50.571691');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (216, 'task_production_line_status', 11, 'wait_for_zk_updated', '{"wait_for_zk": true, "auto_completed": false, "production_line_id": "2"}', 4, NULL, '2026-04-24 13:49:24.676508');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (113, 'task', 17, 'created', NULL, 4, NULL, '2026-02-28 11:06:37.07248');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (218, 'task_production_line_status', 5, 'wait_for_zk_updated', '{"wait_for_zk": true, "auto_completed": false, "production_line_id": "2"}', 4, NULL, '2026-04-24 13:57:06.46612');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (219, 'task_production_line_status', 5, 'wait_for_zk_updated', '{"wait_for_zk": false, "auto_completed": false, "production_line_id": "2"}', 4, NULL, '2026-04-24 13:57:07.678766');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (116, 'task', 18, 'created', NULL, 4, NULL, '2026-02-28 11:11:42.009857');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (224, 'task_production_line_status', 16, 'status_updated', '{"status": "completed", "production_line_id": "1"}', 4, NULL, '2026-04-24 13:59:59.103856');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (118, 'task', 19, 'created', NULL, 4, NULL, '2026-02-28 11:14:00.855959');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (229, 'task_production_line_status', 22, 'wait_for_zk_updated', '{"wait_for_zk": false, "auto_completed": false, "production_line_id": "3"}', 4, NULL, '2026-04-24 15:41:38.615361');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (232, 'task_product', 59, 'execution_status_updated', '{"execution_status": "executed", "product_version_id": "11"}', 4, NULL, '2026-04-24 16:22:24.290537');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (121, 'task', 20, 'created', NULL, 4, NULL, '2026-02-28 11:15:48.90035');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (234, 'product_version', 20, 'published', NULL, 4, NULL, '2026-04-24 16:28:50.725231');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (123, 'task', 21, 'created', NULL, 4, NULL, '2026-02-28 11:16:41.679193');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (236, 'task_production_line_status', 11, 'status_updated', '{"status": "completed", "production_line_id": "2"}', 4, NULL, '2026-04-24 16:44:59.571386');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (125, 'task', 22, 'created', NULL, 4, NULL, '2026-02-28 11:25:31.304546');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (240, 'task_product', 49, 'status_updated', '{"status": "voltooid"}', 4, NULL, '2026-04-24 16:51:59.282445');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (241, 'task_product', 49, 'execution_status_updated', '{"execution_status": "executed", "product_version_id": "22"}', 4, NULL, '2026-04-24 16:52:17.611818');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (242, 'product_version', 22, 'published', NULL, 4, NULL, '2026-04-24 16:52:28.995133');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (246, 'product_version', 12, 'published', NULL, 4, NULL, '2026-04-24 18:56:08.481186');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (249, 'task_product', 42, 'status_updated', '{"status": "voltooid"}', 4, NULL, '2026-04-24 18:56:59.514838');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (252, 'task', 25, 'notification_linked', '{"notificationId": 61, "linkedProductsCount": 9}', 4, NULL, '2026-04-25 11:06:56.51365');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (253, 'task_production_line_status', 5, 'wait_for_zk_updated', '{"wait_for_zk": true, "auto_completed": false, "production_line_id": "2"}', 4, NULL, '2026-04-25 11:07:20.96265');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (255, 'product_version', 32, 'created', NULL, 4, NULL, '2026-04-25 11:27:16.488386');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (257, 'notification', 63, 'created', NULL, 4, NULL, '2026-04-26 11:28:24.084051');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (259, 'notification', 63, 'geometry_updated', '{"type": "Point", "coordinateId": "66"}', 4, NULL, '2026-04-26 11:29:55.307855');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (261, 'notification', 71, 'decided', '{"decision": "Nee", "productionLineId": 2}', 4, NULL, '2026-04-26 12:29:22.078865');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (264, 'notification', 72, 'created', NULL, 4, NULL, '2026-04-26 12:41:44.295793');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (266, 'notification', 72, 'decided', '{"decision": "Ja", "productionLineId": 2}', 4, NULL, '2026-04-26 12:42:14.345532');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (267, 'notification', 61, 'decided', '{"decision": "Ja", "productionLineId": 2}', 4, NULL, '2026-04-26 15:23:43.005614');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (268, 'task_production_line_status', 49, 'wait_for_zk_updated', '{"wait_for_zk": true, "auto_completed": false, "production_line_id": "2"}', 4, NULL, '2026-04-26 15:25:31.828101');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (269, 'notification', 72, 'zone_added_manually', NULL, 4, NULL, '2026-04-27 18:42:33.000989');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (270, 'notification', 63, 'zone_added_manually', NULL, 4, NULL, '2026-04-27 18:42:55.409997');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (271, 'notification', 73, 'created', NULL, 4, NULL, '2026-04-28 11:19:18.245656');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (272, 'notification', 74, 'created', NULL, 4, NULL, '2026-04-28 15:40:31.394849');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (273, 'notification', 74, 'attachment_added', '{"filename": "image001.png"}', 4, NULL, '2026-04-28 15:40:31.613011');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (274, 'notification', 74, 'attachment_added', '{"filename": "image002.png"}', 4, NULL, '2026-04-28 15:40:31.621664');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (275, 'notification', 74, 'attachment_added', '{"filename": "image003.jpg"}', 4, NULL, '2026-04-28 15:40:31.629242');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (276, 'notification', 75, 'created', NULL, 4, NULL, '2026-04-30 08:53:55.933908');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (281, 'task', 31, 'created', NULL, 4, NULL, '2026-04-30 09:04:56.604801');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (277, 'notification', 75, 'attachment_added', '{"filename": "image001.jpg"}', 4, NULL, '2026-04-30 08:53:56.162023');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (278, 'notification', 75, 'attachment_added', '{"filename": "MSI134 26.pdf"}', 4, NULL, '2026-04-30 08:53:56.498922');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (279, 'notification', 76, 'created', NULL, 4, NULL, '2026-04-30 09:04:18.394813');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (280, 'notification', 76, 'attachment_added', '{"filename": "image001.png"}', 4, NULL, '2026-04-30 09:04:19.205143');
INSERT INTO public.activity_log (id, entity_type, entity_id, action, changes, user_id, ip_address, created_at) VALUES (282, 'notification', 76, 'decided', '{"decision": "Ja", "productionLineId": 2}', 4, NULL, '2026-04-30 09:04:56.607894');


ALTER TABLE public.activity_log ENABLE TRIGGER ALL;

--
-- Name: activity_log_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.activity_log_id_seq', 282, true);


--
-- PostgreSQL database dump complete
--


