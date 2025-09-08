# Plan de pruebas de carga

## Objetivos
- Identificar puntos en la arquitectura donde se pueden generar cuellos de botella (factores limitantes) que afectan 2 aspectos clave de nuestro proyecto: experiencia de usuario y recursos e infraestructura.
- Validar la robustez de la aplicación frente a situaciones (pruebas de estres) que impliquen un alto trabajo de computo, generación/eliminación de archivos, entrega de grandes cantidades de información, entre otros.
## Infraestructura
Para la realización de las pruebas seran requeridos 3 servidores con 8 vCPU y 16 GB de RAM y con capacidad de red de unos 10 Gbps, con lo cual se propone usar instancias de tipo (m5.2xlarge) que pueden soportar de manera distribuida unos 500 usuarios que interactuen con la aplicación web ya sea subiendo videos, votando o consultando rankings. Tambien se propone mantener las 3 instancias en una VPC diferente a donde esta alojada la aplicacion (todsd sus instancias), esto con el fin de evaluar en las pruebas la latencia de la red.

Por otro lado, se propone usar Apache JMeter con los listeners: summary report, aggregate report, response time graph, response latencias over time y un backend listener en conjunto con InfluxDB y Grafana para tener un dashboard en vivo de las metricas de interés. Ademas, junto con AWS CloudWatch y Grafana se propone visualizar el uso de los recursos de las maquinas.

A continuación se muestra un esquema de la arquitectura del proceso de pruebas. 

<\ESQUEMA>

## Indicadores
Considerando la arquitectura y funcionamiento de nuestra app, es de interes considerar los siguientes puntos a lo largo de la aplicación y en cada uno definir las metricas a revisar:
- *Subida de videos*:
    - **Throughput de subida**: cuantos videos acepta la aplicación por minuto.
    - **Latencia de subida**: Cuanto tarde un video en subirse hasta que es encolado completamente.
- *Procesamiento de videos*:
    - **Tiempo de cola**: Tiempo que demora un video en ser tomado por un worker para procesar.
    - **% de errores de procesamiento**: porcentaje de videos que quedan mal procesados.
    - **Promedio de tiempo en procesamiento**: tiempo que dura un video desde que llega a la cola hasta que es procesado.
- *Acceso a los videos*:
    - **Latencia de muestra de videos**: Tiempo de respuesta de los endpoints que muestran los videos. 
    - **Latencia de streaming**: Tiempo hasta el inicio de reproducción del video. 
- *Acceso a los rankings*:
    - **Latencia del voto**: Tiempo que toma el endpoint que registra los votos.
    - **Latencia del ranking**: Tiempo de respuesta para mostrar el ranking actualizado. 
- *Consumo de Recursos*:
    - **% de uso de CPU**.
    - **Uso de memoria RAM**.
    - **Tasa de operacioens I/O**.
    - **Uso de red**.
- *Robustez del backend*:
    - **Usuarios concurrentes soportados por la API**.
    - **Throughput maximo**: numero de peticiones a la API que son soportadas de manera concurrente.
## Escenarios y pruebas

En esta sección detallamos los escenarios que consideramos importantes considerar a la hora de evaluar la robustez de nuestra aplicación. Tambien relacionamos los indicadores que deseamos registrar y el criterio que vamos a tener de referencia (objetivo).
| Escenario | Metrica (indicador) |Criterio (SLA)|
|-----------|---------------------|--------------|
| **Carga masiva de videos**: 100 usuarios concurrentes subiendo videos (aprox 150 MB) | Throughput de subida | 100 videos/min|
|**Carga masiva de videos**: 100 usuarios concurrentes subiendo videos (aprox 150 MB) | Latencia de subida |$\leq$ 120s (p95) para videos de 100 MB|
|**Procesamiento de videos**: Tener 1000 videos en cola para procesamiento de los workers|Tiempo de cola|$\leq$ 3 min con  $X$ workers|
|**Procesamiento de videos**: Tener 1000 videos en cola para procesamiento de los workers|% de errores de procesamiento|Tasa de error 2%-5%|
|**Procesamiento de videos**: Tener 1000 videos en cola para procesamiento de los workers|Promedio de tiempo en procesamiento|promedio 60-180s y p95 $\leq$ 6 min|
|**Acceso a los videos**:100 usuarios (diferentes a los que suben) revisando los videos subidos|Latencia de muestra de videos(`/api/videos`)|p95 $\leq$ 2s|
|**Acceso a los videos**:100 usuarios (diferentes a los que suben) revisando los videos subidos|Latencia de streaming|Tiempo $\leq$  3s|
**Acceso a los rankings**: Unos 300 usuarios (concurrentes) consultando los rankings actualizados|Latencia del voto|p95 $\leq$ 1.5s|
|**Acceso a los rankings**: Unos 300 usuarios (concurrentes) consultando los rankings actualizados|Latencia del ranking (vista materalizada)| p95 $\leq$ 3s|
|**Consumo de Recursos**: Bajo el escenario de 500 usuarios concurrentes|% de uso de CPU|$\leq$ 70% (uso usual); $\leq$ 85% (trabajo pesado)|
|**Consumo de Recursos**: Bajo el escenario de 500 usuarios concurrentes|Uso de memoria RAM|$\leq$ 75% (uso usual); $\leq$ 85% (trabajo pesado)|
|**Consumo de Recursos**: Bajo el escenario de 500 usuarios concurrentes|Tasa de operacioens I/O|$\leq$ 70%|
|**Consumo de Recursos**: Bajo el escenario de 500 usuarios concurrentes|Uso de NIC |$\leq$ 70% (7 Gbps)|
|**Robustez del backend**: Con usuarios ejecutando diferentes tareas (subir videos, visualizar, votar, consultar rankings)|Usuarios concurrentes soportados por la API|$\geq$ 400 usuarios|
|**Robustez del backend**: Con usuarios ejecutando diferentes tareas (subir videos, visualizar, votar, consultar rankings)|Throughput máximo|100-200 req/s|
## Simulaciones

¿?