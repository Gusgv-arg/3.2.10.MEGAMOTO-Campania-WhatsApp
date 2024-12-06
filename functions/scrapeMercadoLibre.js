import axios from "axios";
import path from "path";
import { fileURLToPath } from "url";
import ExcelJS from "exceljs";
import { lookModel } from "./lookModelWithEmbedding.js";
//import { allProducts } from "../excel/allproducts.js"; // array para hacer pruebas hardcodeado
import { sendExcelByWhatsApp } from "../utils/sendExcelByWhatsApp.js";
import { adminWhatsAppNotification } from "../utils/adminWhatsAppNotification.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const scrapeMercadoLibre = async (userPhone) => {
	try {
		// Uses other API as a microservice for scrapping
		const precios = await axios.get(
			"https://three-2-13-web-scrapping.onrender.com/scrape/mercado_libre"
		);
		if (precios.data) {
			console.log(
				"Se recibieron precios de Mercado Libre!! Ejemplo primer registro:",
				precios.data[0]
			);
			const message = `*NOTIFICACION:*\nSe recibieron ${precios.data.length} avisos de Mercado Libre. Ahora falta procesar los datos y generar el Excel.\n¡Paciencia!`
			await adminWhatsAppNotification(userPhone, message)

		} else {
			// Si no se reciben datos, lanzar un error
			throw new Error("No se recibieron datos de precios.");
		}

		const allProducts = precios.data;

		let correctModels;
		try {
			correctModels = await lookModel(allProducts);
		} catch (error) {
			console.log("Error  en lookModel.js", error.message);
		}

		// Convertir precios a números
		if (correctModels) {
			// Verificar que correctModels no sea undefined
			correctModels.forEach((model) => {
				if (model.precio) {
					// Verificar si model.precio está definido
					model.precio = parseFloat(
						model.precio.replace(/\./g, "").replace(",", ".")
					);
				} else {
					console.warn(`Precio no definido para el modelo: ${model.modelo}`);
				}
			});
		} else {
			console.warn("No se encontraron modelos correctos.");
		}

		//console.log("correctModels:", correctModels)
		// Ruta del archivo Excel predefinido y la ruta para guardar el archivo actualizado
		/* const templatePath = path.join(
			__dirname,
			"../public/precios_template.xlsx"
		); */

		const templatePath =
			"https://raw.githubusercontent.com/Gusgv-arg/3.2.10.MEGAMOTO-Campania-WhatsApp/main/public/precios_template.xlsx";
		const outputPath = path.join(
			__dirname,
			"../public/precios_mercado_libre.xlsx"
		);

		// Cargar el archivo predefinido
		const workbook = new ExcelJS.Workbook();
		try {
			// Fetch the template file using axios first
			const response = await axios.get(templatePath, {
				responseType: "arraybuffer",
			});
			await workbook.xlsx.load(response.data);
			console.log("Template file loaded successfully");
		} catch (error) {
			console.log("Error al acceder a precios_template.xlsx", error.message);
			const errorMessage =
				"No se pudo cargar el archivo de plantilla. Verifica la URL y el acceso.";
			adminWhatsAppNotification(userPhone, errorMessage);
		}

		// Seleccionar la hoja "Avisos"
		const avisosSheet = workbook.getWorksheet("Avisos");

		if (!avisosSheet) {
			throw new Error("La hoja 'Avisos' no existe en el archivo predefinido.");
		}

		// Limpiar el contenido anterior (manteniendo encabezados)
		const rowCount = avisosSheet.rowCount;
		for (let i = rowCount; i > 1; i--) {
			// Comenzar desde la última fila y eliminar hacia arriba
			avisosSheet.spliceRows(i, 1);
		}

		// Añadir los nuevos datos a la hoja "Avisos"
		avisosSheet.addRows(
			correctModels.map((model) => [
				model.titulo,
				model.modelo,
				model.precio,
				model.link,
				model.ubicacion,
				model.vendedor,
				model.atributos,
			])
		);

		// Guardar el archivo actualizado en una ubicación pública
		await workbook.xlsx.writeFile(outputPath);
		console.log("Archivo actualizado guardado en:", outputPath);

		// Generar la URL pública del archivo
		const fileUrl = `https://three-2-10-megamoto-campania-whatsapp.onrender.com/public/precios_mercado_libre.xlsx`;
		console.log("Archivo disponible en:", fileUrl);

		// Enviar el archivo Excel por WhatsApp (opcional)
		const fileName = "Precios Mercado Libre";
		await sendExcelByWhatsApp(userPhone, fileUrl, fileName);
	} catch (error) {
		console.log("Error en scrapeMercadoLibre.js:", error.message);
		let errorMessage;
		if (error.response && error.response.data && error.response.data.error) {
			// Si hay una respuesta de la API, usar el mensaje de error de la respuesta
			errorMessage = `*NOTIFICACION DE ERROR:*\nError en la API de Scraping: ${error.response.data.error}`;
		} else {
			// Si no hay respuesta, usar el mensaje de error general
			errorMessage = `*NOTIFICACION DE ERROR:*\nHubo un error en la solicitud: ${error.message}`;
		}

		// Manejo específico para el error 502
		if (error.message === "Request failed with status code 502") {
			errorMessage = `*NOTIFICACION DE ERROR:*\nHay un problema momentáneo en Render que es donde está hosteado el Servidor. Puedes intentar nuevamente o esperar una hora.`;
		}
		// Notificar al administrador
		adminWhatsAppNotification(userPhone, errorMessage);
	}
};
//scrapeMercadoLibre()
