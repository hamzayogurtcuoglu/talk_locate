FROM python:3.10.11
WORKDIR /app
COPY requirements.txt ./
RUN apt-get update && apt-get install -y portaudio19-dev
RUN pip install -r requirements.txt
COPY . .
EXPOSE 5000
CMD ["python", "main.py"]